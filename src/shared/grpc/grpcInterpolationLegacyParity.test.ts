/**
 * Phase 9A — legacy wsMessageUtils parity matrix (migration guard for 9B).
 */
import { describe, expect, it } from 'vitest';
import { hasUnresolvedVars, resolveEnvVars } from '../../features/websocket/wsMessageUtils';
import {
  extractGrpcInterpolationTokenNames,
  getGrpcInterpolationTemplateState,
  hasUnresolvedGrpcInterpolationTokens,
  inspectGrpcInterpolationTemplate,
  legacyHasUnresolvedVarsDiffers,
  LEGACY_UNRESOLVED_VAR_PATTERN,
} from './grpcInterpolationGrammar';

describe('grpcInterpolation legacy parity (Phase 9A)', () => {
  it('exports the same unresolved-var regex as wsMessageUtils.hasUnresolvedVars', () => {
    const samples = ['{{host}}', '{{}}', 'plain', '{{a}}{{b}}'];
    for (const sample of samples) {
      expect(LEGACY_UNRESOLVED_VAR_PATTERN.test(sample)).toBe(hasUnresolvedVars(sample));
    }
  });

  it('legacyHasUnresolvedVarsDiffers flags every known divergence class', () => {
    const divergent = [
      '{{}}',
      '{{9bad}}',
      '{{unclosed',
      '{{foo-bar}}',
      '{{foo bar}}',
      String.raw`\{{grpcHost}}`,
      String.raw`\{{literal\}}`,
    ];
    for (const input of divergent) {
      expect(legacyHasUnresolvedVarsDiffers(input)).toBe(true);
    }
  });

  it('legacyHasUnresolvedVarsDiffers is false when both layers agree', () => {
    const aligned = [
      '',
      'echo.EchoService',
      '{{grpcHost}}',
      '{{missing}}',
      'prefix-{{host}}-suffix',
      '{{a}}{{b}}',
    ];
    for (const input of aligned) {
      expect(legacyHasUnresolvedVarsDiffers(input)).toBe(false);
    }
  });

  it('hasUnresolvedGrpcInterpolationTokens ignores invalid legacy-shaped tokens', () => {
    expect(hasUnresolvedVars('{{9bad}}')).toBe(true);
    expect(hasUnresolvedGrpcInterpolationTokens('{{9bad}}')).toBe(false);
    expect(inspectGrpcInterpolationTemplate('{{9bad}}').ok).toBe(false);
  });

  it('escaped literals hide tokens from grammar but not always from legacy regex', () => {
    const escaped = String.raw`\{{grpcHost}}`;
    expect(hasUnresolvedVars(escaped)).toBe(true);
    expect(hasUnresolvedGrpcInterpolationTokens(escaped)).toBe(false);
    expect(legacyHasUnresolvedVarsDiffers(escaped)).toBe(true);
  });

  it('resolveEnvVars incorrectly expands escaped literals (9B must not use legacy resolver)', () => {
    const escaped = String.raw`\{{grpcHost}}`;
    expect(getGrpcInterpolationTemplateState(escaped)).toBe('literal');
    // Legacy regex matches {{grpcHost}} inside the escaped string and replaces it,
    // leaving a stray backslash — grammar treats the whole sequence as literal text.
    expect(resolveEnvVars(escaped, { grpcHost: 'localhost:50051' })).toBe(String.raw`\localhost:50051`);
    expect(hasUnresolvedGrpcInterpolationTokens(escaped)).toBe(false);
  });

  it('valid template token names align with resolveEnvVars substitution keys', () => {
    const template = 'grpc://{{grpcHost}}/{{svcName}}';
    const env = { grpcHost: 'localhost:50051', svcName: 'echo' };
    expect(extractGrpcInterpolationTokenNames(template)).toEqual(['grpcHost', 'svcName']);
    expect(resolveEnvVars(template, env)).toBe('grpc://localhost:50051/echo');
    expect(getGrpcInterpolationTemplateState(template)).toBe('unresolved');
    expect(getGrpcInterpolationTemplateState(resolveEnvVars(template, env))).toBe('literal');
    expect(getGrpcInterpolationTemplateState('{{missing}}')).toBe('unresolved');
    expect(getGrpcInterpolationTemplateState('{{9bad}}')).toBe('invalid_syntax');
  });
});
