import { describe, expect, it } from 'vitest';
import {
  assertGrpcInterpolationAuthTemplatesResolved,
  assertGrpcInterpolationJsonTemplatesResolved,
  assertGrpcInterpolationMetadataNormalizeUnique,
  resolveGrpcInterpolationAuthConfig,
  resolveGrpcInterpolationJsonValue,
  resolveGrpcInterpolationMetadata,
} from './grpcInterpolationDeepResolver';
import { createGrpcInterpolationTemplateResolver } from './grpcInterpolationResolver';

describe('grpcInterpolationDeepResolver coverage gaps', () => {
  const resolve = createGrpcInterpolationTemplateResolver({ host: 'h', scope: 'read' });

  it('walks arrays and nested objects when asserting JSON templates', () => {
    expect(() => assertGrpcInterpolationJsonTemplatesResolved([
      { nested: '{{missing}}' },
    ])).toThrow(/unresolved template variables/);
    expect(() => assertGrpcInterpolationJsonTemplatesResolved({ '{{bad}}': 'value' }))
      .toThrow(/unresolved template variables/);
  });

  it('assertGrpcInterpolationMetadataNormalizeUnique rejects empty and duplicate keys', () => {
    expect(() => assertGrpcInterpolationMetadataNormalizeUnique({ '': 'x' }))
      .toThrow(/metadata key is required/);
    expect(() => assertGrpcInterpolationMetadataNormalizeUnique({ Authorization: 'a', authorization: 'b' }))
      .toThrow(/metadata key collision after normalization/);
  });

  it('assertGrpcInterpolationAuthTemplatesResolved walks all auth field shapes', () => {
    expect(() => assertGrpcInterpolationAuthTemplatesResolved({
      type: 'basic',
      basicUsername: '{{user}}',
      basicPassword: '{{pass}}',
    })).toThrow(/unresolved template variables/);
    expect(() => assertGrpcInterpolationAuthTemplatesResolved({
      type: 'api_key',
      apiKeyName: '{{name}}',
      apiKeyValue: '{{value}}',
    })).toThrow(/unresolved template variables/);
    expect(() => assertGrpcInterpolationAuthTemplatesResolved({
      type: 'oauth2',
      oauth2: {
        tokenUrl: '{{url}}',
        clientId: '{{id}}',
        clientSecret: '{{secret}}',
        scope: '{{scope}}',
      },
    })).toThrow(/unresolved template variables/);
  });

  it('returns primitives unchanged and empty metadata for undefined input', () => {
    expect(resolveGrpcInterpolationJsonValue(42, resolve)).toBe(42);
    expect(resolveGrpcInterpolationJsonValue(null, resolve)).toBeNull();
    expect(resolveGrpcInterpolationJsonValue(['{{host}}', 'plain'], resolve)).toEqual(['h', 'plain']);
    expect(resolveGrpcInterpolationMetadata(undefined, resolve)).toEqual({});
  });

  it('assertGrpcInterpolationAuthTemplatesResolved accepts resolved bearer token', () => {
    expect(() => assertGrpcInterpolationAuthTemplatesResolved({
      type: 'bearer',
      bearerToken: 'resolved-token',
    })).not.toThrow();
  });

  it('resolveGrpcInterpolationAuthConfig interpolates basic, api_key, and oauth2 fields', () => {
    expect(resolveGrpcInterpolationAuthConfig(undefined, resolve)).toBeUndefined();
    expect(resolveGrpcInterpolationAuthConfig({ type: 'none' }, resolve)).toEqual({ type: 'none' });
    expect(resolveGrpcInterpolationAuthConfig({
      type: 'basic',
      basicUsername: '{{host}}',
      basicPassword: 'secret',
    }, resolve)).toEqual({
      type: 'basic',
      basicUsername: 'h',
      basicPassword: 'secret',
    });
    expect(resolveGrpcInterpolationAuthConfig({
      type: 'api_key',
      apiKeyName: '{{host}}',
      apiKeyValue: 'v',
    }, resolve)).toEqual({
      type: 'api_key',
      apiKeyName: 'h',
      apiKeyValue: 'v',
    });
    expect(resolveGrpcInterpolationAuthConfig({
      type: 'oauth2',
      oauth2: {
        tokenUrl: 'https://auth/{{host}}',
        clientId: 'id',
        clientSecret: 'sec',
        scope: '{{scope}}',
      },
    }, resolve)?.oauth2).toEqual({
      tokenUrl: 'https://auth/h',
      clientId: 'id',
      clientSecret: 'sec',
      scope: 'read',
    });
  });
});
