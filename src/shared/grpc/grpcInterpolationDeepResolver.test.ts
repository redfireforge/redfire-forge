/**
 * Phase 9B — deep interpolation resolver tests.
 */
import { describe, expect, it } from 'vitest';
import {
  assertGrpcInterpolationJsonTemplatesResolved,
  assertGrpcInterpolationTemplatesResolved,
  resolveGrpcInterpolationAuthConfig,
  resolveGrpcInterpolationJsonValue,
  resolveGrpcInterpolationMetadata,
} from './grpcInterpolationDeepResolver';
import { createGrpcInterpolationTemplateResolver } from './grpcInterpolationResolver';

describe('grpcInterpolationDeepResolver (Phase 9B)', () => {
  const env = { greeting: 'hello', orderId: '99', token: 'abc', a: 'x', b: 'y' };
  const resolveTemplate = createGrpcInterpolationTemplateResolver(env);

  it('deep-interpolates JSON body values and keys', () => {
    const resolved = resolveGrpcInterpolationJsonValue(
      { message: '{{greeting}}', nested: { id: '{{orderId}}' }, '{{a}}': '1' },
      resolveTemplate,
    );
    expect(resolved).toEqual({ message: 'hello', nested: { id: '99' }, x: '1' });
  });

  it('interpolates metadata keys and values', () => {
    expect(resolveGrpcInterpolationMetadata(
      { 'x-{{a}}': '{{greeting}}' },
      resolveTemplate,
    )).toEqual({ 'x-x': 'hello' });
  });

  it('interpolates auth string fields', () => {
    expect(resolveGrpcInterpolationAuthConfig(
      { type: 'bearer', bearerToken: '{{token}}' },
      resolveTemplate,
    )).toEqual({ type: 'bearer', bearerToken: 'abc' });
  });

  it('rejects metadata key collisions after template resolution', () => {
    expect(() => resolveGrpcInterpolationMetadata(
      { '{{a}}': 'one', '{{b}}': 'two' },
      () => 'same-key',
    )).toThrow(/metadata key collision after template resolution/i);
  });

  it('rejects body key collisions after template resolution', () => {
    expect(() => resolveGrpcInterpolationJsonValue(
      { '{{a}}': '1', '{{b}}': '2' },
      () => 'dup-key',
    )).toThrow(/body key collision after template resolution/i);
  });

  it('rejects unresolved tokens in JSON leaves using Phase 9A grammar', () => {
    expect(() => assertGrpcInterpolationJsonTemplatesResolved({ message: '{{missing}}' }))
      .toThrow('unresolved template variables');
    expect(() => assertGrpcInterpolationTemplatesResolved('target', '{{grpcHost}}'))
      .toThrow('unresolved template variables');
  });

  it('rejects invalid syntax in resolved string leaves', () => {
    expect(() => assertGrpcInterpolationTemplatesResolved('target', '{{unclosed'))
      .toThrow(/Unclosed interpolation token/);
  });
});
