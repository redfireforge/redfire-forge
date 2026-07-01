/**
 * Coverage gaps — grpcHarnessTemplateResolver.ts (Phase 8B).
 */
import { describe, expect, it } from 'vitest';
import type { GrpcAuthConfig } from './contracts';
import {
  assertGrpcHarnessAuthTemplatesResolved,
  assertGrpcHarnessMetadataNormalizeUnique,
  resolveGrpcHarnessAuthConfig,
  resolveGrpcHarnessCollectConfig,
  resolveGrpcHarnessJsonValue,
  resolveGrpcHarnessMetadata,
  resolveGrpcHarnessSendMessages,
} from './grpcHarnessTemplateResolver';

const resolve = (template: string) => template.replace('{{token}}', 'resolved');

describe('grpcHarnessTemplateResolver coverage gaps', () => {
  it('returns primitives unchanged from resolveGrpcHarnessJsonValue', () => {
    expect(resolveGrpcHarnessJsonValue(42, resolve)).toBe(42);
    expect(resolveGrpcHarnessJsonValue(true, resolve)).toBe(true);
    expect(resolveGrpcHarnessJsonValue(null, resolve)).toBeNull();
  });

  it('returns empty sendMessages when input is missing or empty', () => {
    expect(resolveGrpcHarnessSendMessages(undefined, resolve)).toEqual([]);
    expect(resolveGrpcHarnessSendMessages([], resolve)).toEqual([]);
  });

  it('passes through collect config fields', () => {
    expect(resolveGrpcHarnessCollectConfig({ maxMessages: 5, maxDurationMs: 1000 })).toEqual({
      maxMessages: 5,
      maxDurationMs: 1000,
    });
  });

  it('returns undefined metadata input as empty object from resolveGrpcHarnessMetadata', () => {
    expect(resolveGrpcHarnessMetadata(undefined, resolve)).toEqual({});
  });

  it('resolves bearer, basic, api key, and oauth2 auth fields', () => {
    const auth: GrpcAuthConfig = {
      type: 'oauth2',
      bearerToken: '{{token}}',
      basicUsername: '{{token}}',
      basicPassword: '{{token}}',
      apiKeyName: '{{token}}',
      apiKeyValue: '{{token}}',
      oauth2: {
        tokenUrl: '{{token}}',
        clientId: '{{token}}',
        clientSecret: '{{token}}',
        scope: '{{token}}',
      },
    };
    const resolved = resolveGrpcHarnessAuthConfig(auth, resolve);
    expect(resolved?.bearerToken).toBe('resolved');
    expect(resolved?.oauth2?.scope).toBe('resolved');
  });

  it('returns none auth unchanged', () => {
    expect(resolveGrpcHarnessAuthConfig({ type: 'none' }, resolve)).toEqual({ type: 'none' });
    expect(resolveGrpcHarnessAuthConfig(undefined, resolve)).toBeUndefined();
  });

  it('rejects duplicate metadata keys after normalization', () => {
    expect(() => assertGrpcHarnessMetadataNormalizeUnique({
      'X-Custom': 'one',
      'x-custom': 'two',
    })).toThrow(/metadata key collision after normalization/i);
    expect(() => assertGrpcHarnessMetadataNormalizeUnique({
      '   ': 'value',
    })).toThrow(/metadata key is required/i);
  });

  it('rejects unresolved auth template tokens', () => {
    expect(() => assertGrpcHarnessAuthTemplatesResolved({
      type: 'bearer',
      bearerToken: '{{missing}}',
    })).toThrow(/unresolved template variables/i);
    expect(() => assertGrpcHarnessAuthTemplatesResolved({
      type: 'basic',
      basicUsername: '{{missing}}',
      basicPassword: 'secret',
    })).toThrow(/Basic auth username/i);
    expect(() => assertGrpcHarnessAuthTemplatesResolved({
      type: 'api_key',
      apiKeyName: '{{missing}}',
      apiKeyValue: 'value',
    })).toThrow(/API key name/i);
    expect(() => assertGrpcHarnessAuthTemplatesResolved({
      type: 'oauth2',
      oauth2: {
        tokenUrl: '{{missing}}',
        clientId: 'id',
        clientSecret: 'secret',
      },
    })).toThrow(/OAuth2 token URL/i);
  });
});
