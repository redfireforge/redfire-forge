/**
 * Phase 9B — string interpolation resolver tests.
 */
import { describe, expect, it } from 'vitest';
import {
  createGrpcInterpolationTemplateResolver,
  listGrpcInterpolationTokenNames,
  resolveGrpcInterpolationTemplate,
} from './grpcInterpolationResolver';

describe('grpcInterpolationResolver (Phase 9B)', () => {
  const env = { grpcHost: 'localhost:50051', grpcPort: '50051', greeting: 'hello' };

  it('substitutes valid tokens from a flat env map', () => {
    expect(resolveGrpcInterpolationTemplate('{{grpcHost}}', env)).toEqual({
      value: 'localhost:50051',
      state: 'literal',
      unresolvedTokenNames: [],
    });
    expect(resolveGrpcInterpolationTemplate('prefix-{{greeting}}-{{grpcPort}}', env)).toEqual({
      value: 'prefix-hello-50051',
      state: 'literal',
      unresolvedTokenNames: [],
    });
  });

  it('leaves unresolved tokens in place', () => {
    const result = resolveGrpcInterpolationTemplate('{{missing}}', env);
    expect(result.value).toBe('{{missing}}');
    expect(result.state).toBe('unresolved');
    expect(result.unresolvedTokenNames).toEqual(['missing']);
  });

  it('preserves escaped literals without substitution', () => {
    const escaped = String.raw`\{{grpcHost}}`;
    expect(createGrpcInterpolationTemplateResolver(env)(escaped)).toBe(escaped);
    expect(resolveGrpcInterpolationTemplate(escaped, env).state).toBe('literal');
  });

  it('returns invalid_syntax state without mutating the template by default', () => {
    expect(resolveGrpcInterpolationTemplate('{{}}', env)).toEqual({
      value: '{{}}',
      state: 'invalid_syntax',
      unresolvedTokenNames: [],
    });
  });

  it('supports strict and fully-resolved modes', () => {
    expect(() => resolveGrpcInterpolationTemplate('{{}}', env, { strictSyntax: true }))
      .toThrow(/Empty interpolation token/);
    expect(() => resolveGrpcInterpolationTemplate('{{missing}}', env, { requireFullyResolved: true }))
      .toThrow(/Unresolved interpolation tokens: missing/);
  });

  it('lists token names using Phase 9A grammar', () => {
    expect(listGrpcInterpolationTokenNames('{{ grpcHost }}:{{grpcPort}}')).toEqual([
      'grpcHost',
      'grpcPort',
    ]);
  });
});
