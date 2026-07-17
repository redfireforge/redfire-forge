/**
 * Coverage gaps — grpcWorkflowTemplateResolver.ts
 */
import { describe, expect, it } from 'vitest';
import {
  assertGrpcWorkflowAuthTemplatesResolved,
  assertGrpcWorkflowJsonTemplatesResolved,
  resolveGrpcWorkflowAuthConfig,
  resolveGrpcWorkflowCollectConfig,
  resolveGrpcWorkflowJsonValue,
  resolveGrpcWorkflowMetadata,
  resolveGrpcWorkflowTemplateString,
} from './grpcWorkflowTemplateResolver';

const resolve = (template: string) => template.replace(/\{\{(\w+)\}\}/g, (_m, key: string) => {
  const map: Record<string, string> = {
    host: 'localhost',
    token: 'secret',
    user: 'alice',
    pass: 'pw',
    keyName: 'x-api-key',
    keyValue: 'vault-key',
    tokenUrl: 'https://auth.example/token',
    clientId: 'client-id',
    clientSecret: 'client-secret',
    scope: 'read',
  };
  return map[key] ?? `{{${key}}}`;
});

describe('grpcWorkflowTemplateResolver coverage gaps', () => {
  it('resolveGrpcWorkflowTemplateString delegates to resolver', () => {
    expect(resolveGrpcWorkflowTemplateString('{{host}}', resolve)).toBe('localhost');
  });

  it('resolveGrpcWorkflowMetadata returns empty object when metadata is undefined', () => {
    expect(resolveGrpcWorkflowMetadata(undefined, resolve)).toEqual({});
  });

  it('resolveGrpcWorkflowJsonValue returns primitives unchanged', () => {
    expect(resolveGrpcWorkflowJsonValue(42, resolve)).toBe(42);
    expect(resolveGrpcWorkflowJsonValue(null, resolve)).toBeNull();
  });

  it('resolveGrpcWorkflowAuthConfig interpolates basic, api_key, and oauth2 fields', () => {
    expect(resolveGrpcWorkflowAuthConfig({
      type: 'basic',
      basicUsername: '{{user}}',
      basicPassword: '{{pass}}',
    }, resolve)).toEqual({
      type: 'basic',
      basicUsername: 'alice',
      basicPassword: 'pw',
    });

    expect(resolveGrpcWorkflowAuthConfig({
      type: 'api_key',
      apiKeyName: '{{keyName}}',
      apiKeyValue: '{{keyValue}}',
    }, resolve)).toEqual({
      type: 'api_key',
      apiKeyName: 'x-api-key',
      apiKeyValue: 'vault-key',
    });

    expect(resolveGrpcWorkflowAuthConfig({
      type: 'oauth2',
      oauth2: {
        tokenUrl: '{{tokenUrl}}',
        clientId: '{{clientId}}',
        clientSecret: '{{clientSecret}}',
        scope: '{{scope}}',
      },
    }, resolve)).toEqual({
      type: 'oauth2',
      oauth2: {
        tokenUrl: 'https://auth.example/token',
        clientId: 'client-id',
        clientSecret: 'client-secret',
        scope: 'read',
      },
    });
  });

  it('resolveGrpcWorkflowCollectConfig omits blank untilExpression', () => {
    expect(resolveGrpcWorkflowCollectConfig({
      maxMessages: 3,
      untilExpression: '   ',
    }, resolve)).toEqual({ maxMessages: 3, untilExpression: undefined });
  });

  it('resolveGrpcWorkflowAuthConfig returns none auth unchanged', () => {
    expect(resolveGrpcWorkflowAuthConfig({ type: 'none' }, resolve)).toEqual({ type: 'none' });
    expect(resolveGrpcWorkflowAuthConfig(undefined, resolve)).toBeUndefined();
  });

  it('assertGrpcWorkflowAuthTemplatesResolved checks bearer, basic, api_key, and oauth2 scope', () => {
    expect(() => assertGrpcWorkflowAuthTemplatesResolved({
      type: 'bearer',
      bearerToken: '{{missing}}',
    })).toThrow(/Bearer token/);

    expect(() => assertGrpcWorkflowAuthTemplatesResolved({
      type: 'basic',
      basicUsername: '{{missing}}',
      basicPassword: 'pw',
    })).toThrow(/Basic auth username/);

    expect(() => assertGrpcWorkflowAuthTemplatesResolved({
      type: 'api_key',
      apiKeyName: 'x-key',
      apiKeyValue: '{{missing}}',
    })).toThrow(/API key value/);

    expect(() => assertGrpcWorkflowAuthTemplatesResolved({
      type: 'oauth2',
      oauth2: {
        tokenUrl: 'https://auth.example/token',
        clientId: 'id',
        clientSecret: 'secret',
        scope: '{{missing}}',
      },
    })).toThrow(/OAuth2 scope/);
  });

  it('assertGrpcWorkflowJsonTemplatesResolved walks array entries', () => {
    expect(() => assertGrpcWorkflowJsonTemplatesResolved([
      'ok',
      '{{missing}}',
    ])).toThrow(/gRPC body\[1\]/);
  });
});
