/**
 * Phase 9A — interpolation grammar tests.
 */
import { describe, expect, it } from 'vitest';
import {
  containsGrpcInterpolationToken,
  escapeGrpcInterpolationLiterals,
  extractGrpcInterpolationTokenNames,
  extractGrpcInterpolationTokenNamesSafe,
  GrpcInterpolationSyntaxError,
  getGrpcInterpolationTemplateState,
  hasUnresolvedGrpcInterpolationTokens,
  inspectGrpcInterpolationTemplate,
  legacyHasUnresolvedVarsDiffers,
  LEGACY_UNRESOLVED_VAR_PATTERN,
  tokenizeGrpcInterpolation,
  unescapeGrpcInterpolationLiterals,
} from './grpcInterpolationGrammar';

describe('tokenizeGrpcInterpolation (Phase 9A)', () => {
  it('parses a single token', () => {
    expect(tokenizeGrpcInterpolation('{{grpcHost}}')).toEqual([
      { kind: 'token', name: 'grpcHost', raw: '{{grpcHost}}' },
    ]);
  });

  it('parses mixed literal and token segments', () => {
    expect(tokenizeGrpcInterpolation('prefix-{{grpcHost}}-suffix')).toEqual([
      { kind: 'literal', value: 'prefix-' },
      { kind: 'token', name: 'grpcHost', raw: '{{grpcHost}}' },
      { kind: 'literal', value: '-suffix' },
    ]);
  });

  it('trims whitespace inside token delimiters', () => {
    expect(extractGrpcInterpolationTokenNames('{{ grpcHost }}')).toEqual(['grpcHost']);
  });

  it('parses multiple tokens in order', () => {
    expect(extractGrpcInterpolationTokenNames('{{grpcHost}}:{{grpcPort}}')).toEqual([
      'grpcHost',
      'grpcPort',
    ]);
  });

  it('treats escaped opening braces as literals', () => {
    expect(tokenizeGrpcInterpolation(String.raw`\{{literal}}`)).toEqual([
      { kind: 'literal', value: '{{literal}}' },
    ]);
    expect(containsGrpcInterpolationToken(String.raw`\{{grpcHost}}`)).toBe(false);
  });

  it('treats escaped closing braces as literals inside literals', () => {
    const input = String.raw`value \}} end`;
    expect(tokenizeGrpcInterpolation(input)).toEqual([
      { kind: 'literal', value: 'value }} end' },
    ]);
  });

  it('parses plan escape example with both escaped open and close', () => {
    const input = String.raw`\{{literal\}}`;
    expect(tokenizeGrpcInterpolation(input)).toEqual([
      { kind: 'literal', value: '{{literal}}' },
    ]);
    expect(containsGrpcInterpolationToken(input)).toBe(false);
  });

  it('inspectGrpcInterpolationTemplate returns syntax errors without throwing', () => {
    expect(inspectGrpcInterpolationTemplate('{{}}')).toEqual({
      ok: false,
      error: expect.any(GrpcInterpolationSyntaxError),
    });
    expect(inspectGrpcInterpolationTemplate('echo.Service')).toEqual({
      ok: true,
      segments: [{ kind: 'literal', value: 'echo.Service' }],
      hasToken: false,
    });
  });

  it('rejects unclosed opening delimiters', () => {
    expect(() => tokenizeGrpcInterpolation('{{grpcHost')).toThrow(GrpcInterpolationSyntaxError);
    expect(() => tokenizeGrpcInterpolation('{{grpcHost')).toThrow(/Unclosed interpolation token/);
  });

  it('rejects empty token names', () => {
    expect(() => tokenizeGrpcInterpolation('{{}}')).toThrow(/Empty interpolation token name/);
  });

  it('rejects invalid token names', () => {
    expect(() => tokenizeGrpcInterpolation('{{9bad}}')).toThrow(/Invalid interpolation token name/);
    expect(() => tokenizeGrpcInterpolation('{{bad-name}}')).toThrow(/Invalid interpolation token name/);
  });

  it('round-trips escape helpers', () => {
    const raw = '{{not-a-token}}';
    const escaped = escapeGrpcInterpolationLiterals(raw);
    expect(containsGrpcInterpolationToken(escaped)).toBe(false);
    expect(unescapeGrpcInterpolationLiterals(escaped)).toBe(raw);
  });

  it('containsGrpcInterpolationToken throws on invalid syntax', () => {
    expect(() => containsGrpcInterpolationToken('{{}}')).toThrow(GrpcInterpolationSyntaxError);
  });

  it('hasUnresolvedGrpcInterpolationTokens matches valid unresolved tokens only', () => {
    expect(hasUnresolvedGrpcInterpolationTokens('{{missing}}')).toBe(true);
    expect(hasUnresolvedGrpcInterpolationTokens(String.raw`\{{missing}}`)).toBe(false);
    expect(hasUnresolvedGrpcInterpolationTokens('{{}}')).toBe(false);
    expect(hasUnresolvedGrpcInterpolationTokens('{{9bad}}')).toBe(false);
  });

  it('legacyHasUnresolvedVarsDiffers is true when escapes hide tokens from legacy regex', () => {
    expect(legacyHasUnresolvedVarsDiffers(String.raw`\{{grpcHost}}`)).toBe(true);
    expect(legacyHasUnresolvedVarsDiffers('{{grpcHost}}')).toBe(false);
  });

  it('legacyHasUnresolvedVarsDiffers detects strict grammar vs legacy empty/invalid tokens', () => {
    expect(legacyHasUnresolvedVarsDiffers('{{}}')).toBe(true);
    expect(legacyHasUnresolvedVarsDiffers('{{9bad}}')).toBe(true);
    expect(legacyHasUnresolvedVarsDiffers('{{unclosed')).toBe(true);
    expect(legacyHasUnresolvedVarsDiffers('echo.Service')).toBe(false);
  });

  it('legacyHasUnresolvedVarsDiffers is true when grammar throws on malformed escaped input', () => {
    expect(legacyHasUnresolvedVarsDiffers(String.raw`\{{{{host`)).toBe(true);
  });

  it('extractGrpcInterpolationTokenNamesSafe returns syntax errors without throwing', () => {
    expect(extractGrpcInterpolationTokenNamesSafe('{{host}}')).toEqual({
      ok: true,
      names: ['host'],
    });
    expect(extractGrpcInterpolationTokenNamesSafe('{{}}').ok).toBe(false);
  });

  it('extractGrpcInterpolationTokenNamesSafe matches strict extract for valid templates', () => {
    const template = '{{grpcHost}}:{{grpcPort}}';
    expect(extractGrpcInterpolationTokenNamesSafe(template)).toEqual({
      ok: true,
      names: ['grpcHost', 'grpcPort'],
    });
    expect(extractGrpcInterpolationTokenNames(template)).toEqual(['grpcHost', 'grpcPort']);
  });

  it('getGrpcInterpolationTemplateState classifies literal, unresolved, and invalid syntax', () => {
    expect(getGrpcInterpolationTemplateState('echo.Service')).toBe('literal');
    expect(getGrpcInterpolationTemplateState('{{grpcHost}}')).toBe('unresolved');
    expect(getGrpcInterpolationTemplateState('{{}}')).toBe('invalid_syntax');
    expect(getGrpcInterpolationTemplateState(String.raw`\{{grpcHost}}`)).toBe('literal');
  });

  it('exports legacy unresolved-var pattern matching wsMessageUtils', () => {
    expect(LEGACY_UNRESOLVED_VAR_PATTERN.test('{{host}}')).toBe(true);
    expect(LEGACY_UNRESOLVED_VAR_PATTERN.test('{{}}')).toBe(false);
  });
});
