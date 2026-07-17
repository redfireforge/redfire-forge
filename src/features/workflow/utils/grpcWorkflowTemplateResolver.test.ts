/**
 * Phase 6B — gRPC workflow template resolver tests.
 */
import { describe, expect, it } from 'vitest';
import {
  assertGrpcWorkflowAuthTemplatesResolved,
  assertGrpcWorkflowJsonTemplatesResolved,
  assertGrpcWorkflowMetadataNormalizeUnique,
  assertGrpcWorkflowTemplatesResolved,
  resolveGrpcWorkflowAuthConfig,
  resolveGrpcWorkflowCollectConfig,
  resolveGrpcWorkflowJsonValue,
  resolveGrpcWorkflowMetadata,
} from './grpcWorkflowTemplateResolver';

const resolve = (template: string) => template.replace(/\{\{(\w+)\}\}/g, (_m, key: string) => {
  const map: Record<string, string> = {
    host: 'localhost',
    port: '50051',
    token: 'secret-token',
    doneFlag: 'true',
  };
  return map[key] ?? `{{${key}}}`;
});

describe('grpcWorkflowTemplateResolver (Phase 6B)', () => {
  it('resolveGrpcWorkflowJsonValue deep-interpolates string leaves', () => {
    const resolved = resolveGrpcWorkflowJsonValue({
      message: '{{host}}:{{port}}',
      nested: { count: 1, label: '{{host}}' },
      items: ['{{host}}'],
    }, resolve);
    expect(resolved).toEqual({
      message: 'localhost:50051',
      nested: { count: 1, label: 'localhost' },
      items: ['localhost'],
    });
  });

  it('resolveGrpcWorkflowMetadata interpolates keys and values', () => {
    expect(resolveGrpcWorkflowMetadata({ 'x-{{host}}': '{{host}}-id' }, resolve)).toEqual({
      'x-localhost': 'localhost-id',
    });
  });

  it('resolveGrpcWorkflowJsonValue interpolates object keys', () => {
    const resolved = resolveGrpcWorkflowJsonValue({
      '{{host}}': '{{host}}:{{port}}',
    }, resolve);
    expect(resolved).toEqual({ localhost: 'localhost:50051' });
  });

  it('resolveGrpcWorkflowAuthConfig interpolates bearer token', () => {
    const auth = resolveGrpcWorkflowAuthConfig({
      type: 'bearer',
      bearerToken: '{{token}}',
    }, resolve);
    expect(auth?.bearerToken).toBe('secret-token');
  });

  it('resolveGrpcWorkflowCollectConfig interpolates untilExpression', () => {
    expect(resolveGrpcWorkflowCollectConfig({
      maxMessages: 5,
      untilExpression: '$.done == {{doneFlag}}',
    }, resolve)).toEqual({
      maxMessages: 5,
      untilExpression: '$.done == true',
    });
  });

  it('assertGrpcWorkflowTemplatesResolved throws for leftover tokens', () => {
    expect(() => assertGrpcWorkflowTemplatesResolved('target', '{{missing}}')).toThrow(/unresolved/i);
  });

  it('assertGrpcWorkflowJsonTemplatesResolved walks nested body strings', () => {
    expect(() => assertGrpcWorkflowJsonTemplatesResolved({
      message: '{{missing}}',
      nested: [{ token: 'ok' }],
    })).toThrow(/gRPC body\.message/);
    expect(() => assertGrpcWorkflowJsonTemplatesResolved({
      '{{missing}}': 'ok',
    })).toThrow(/gRPC body key/);
    expect(() => assertGrpcWorkflowJsonTemplatesResolved({ ok: 'value' })).not.toThrow();
  });

  it('resolveGrpcWorkflowMetadata throws on key collision after interpolation', () => {
    expect(() => resolveGrpcWorkflowMetadata({
      'x-{{host}}': 'one',
      'x-{{port}}': 'two',
    }, (template) => template.replace(/\{\{host\}\}/g, 'localhost').replace(/\{\{port\}\}/g, 'localhost'))).toThrow(/metadata key collision/i);
  });

  it('resolveGrpcWorkflowJsonValue throws on key collision after interpolation', () => {
    expect(() => resolveGrpcWorkflowJsonValue({
      '{{host}}': 'a',
      'localhost': 'b',
    }, resolve)).toThrow(/body key collision/i);
  });

  it('assertGrpcWorkflowMetadataNormalizeUnique rejects case-insensitive duplicates', () => {
    expect(() => assertGrpcWorkflowMetadataNormalizeUnique({
      'X-dev': 'one',
      'x-dev': 'two',
    })).toThrow(/normalization/i);
    expect(() => assertGrpcWorkflowMetadataNormalizeUnique({
      'x-trace': 'ok',
    })).not.toThrow();
  });

  it('assertGrpcWorkflowMetadataNormalizeUnique rejects empty keys', () => {
    expect(() => assertGrpcWorkflowMetadataNormalizeUnique({ '   ': 'value' })).toThrow(/metadata key is required/i);
  });

  it('assertGrpcWorkflowAuthTemplatesResolved checks oauth2 fields', () => {
    expect(() => assertGrpcWorkflowAuthTemplatesResolved({
      type: 'oauth2',
      oauth2: {
        tokenUrl: '{{tokenUrl}}',
        clientId: 'id',
        clientSecret: 'secret',
      },
    })).toThrow(/OAuth2 token URL/);
  });
});
