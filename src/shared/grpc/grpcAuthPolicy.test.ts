/**
 * Phase 4A — auth precedence and validation contract tests.
 */
import { describe, expect, it } from 'vitest';
import {
  buildAuthMetadataHeaders,
  mergeGrpcExecuteMetadata,
  prepareGrpcExecuteRequestMetadata,
  validateGrpcAuthConfigContract,
  validateGrpcAuthForExecute,
} from './grpcAuthPolicy';

describe('grpcAuthPolicy (Phase 4A)', () => {
  it('builds bearer and basic authorization headers', () => {
    const bearer = buildAuthMetadataHeaders({ type: 'bearer', bearerToken: 'secret-token' });
    expect(bearer.ok).toBe(true);
    if (bearer.ok) {
      expect(bearer.metadata.authorization).toBe('Bearer secret-token');
    }

    const basic = buildAuthMetadataHeaders({
      type: 'basic',
      basicUsername: 'alice',
      basicPassword: 'pass',
    });
    expect(basic.ok).toBe(true);
    if (basic.ok) {
      expect(basic.metadata.authorization).toMatch(/^Basic /);
    }
  });

  it('builds api key headers with lowercase header names', () => {
    const result = buildAuthMetadataHeaders({
      type: 'api_key',
      apiKeyName: 'X-Api-Key',
      apiKeyValue: 'abc123',
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.metadata['x-api-key']).toBe('abc123');
    }
  });

  it('rejects direct oauth2 metadata merge (server resolves at execute time)', () => {
    const result = buildAuthMetadataHeaders({
      type: 'oauth2',
      oauth2: {
        tokenUrl: 'https://auth.example.com/token',
        clientId: 'client',
        clientSecret: 'secret',
      },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/server-side at execute time/i);
    }
  });

  it('records auth/manual conflicts when manual authorization differs', () => {
    const merged = mergeGrpcExecuteMetadata(
      { Authorization: 'Bearer manual-token', 'x-trace': '1' },
      { type: 'bearer', bearerToken: 'panel-token' },
    );
    expect(merged.ok).toBe(false);
    if (!merged.ok) {
      expect(merged.field).toBe('auth');
      expect(merged.error).toMatch(/authorization/i);
    }
  });

  it('blocks execute metadata merge when auth conflicts with manual metadata', () => {
    const merged = mergeGrpcExecuteMetadata(
      { authorization: 'Bearer manual-token' },
      { type: 'bearer', bearerToken: 'panel-token' },
    );
    expect(merged.ok).toBe(false);
    if (!merged.ok) {
      expect(merged.field).toBe('auth');
      expect(merged.error).toMatch(/authorization/i);
    }
  });

  it('blocks oauth2 execute passthrough metadata when manual authorization is present', () => {
    expect(() => prepareGrpcExecuteRequestMetadata(
      { authorization: 'Bearer manual-token' },
      {
        type: 'oauth2',
        oauth2: {
          tokenUrl: 'https://auth.example.com/token',
          clientId: 'client',
          clientSecret: 'secret',
        },
      },
    )).toThrow(/authorization/i);
  });

  it('validates required auth fields for each auth type', () => {
    expect(validateGrpcAuthConfigContract({ type: 'bearer' })).toEqual([
      expect.objectContaining({ field: 'auth.bearerToken' }),
    ]);
    expect(validateGrpcAuthConfigContract({
      type: 'basic',
      basicUsername: 'alice',
    })).toEqual([]);
    expect(validateGrpcAuthConfigContract({
      type: 'api_key',
      apiKeyName: 'x-key',
    })).toEqual([
      expect.objectContaining({ field: 'auth.apiKeyValue' }),
    ]);
  });

  it('validateGrpcAuthForExecute allows oauth2 when shape is valid (Phase 4D)', () => {
    expect(validateGrpcAuthForExecute({
      type: 'oauth2',
      oauth2: {
        tokenUrl: 'https://auth.example.com/token',
        clientId: 'client',
        clientSecret: 'secret',
      },
    })).toEqual([]);
  });

  it('prepareGrpcExecuteRequestMetadata passes oauth2 through without client-side merge', () => {
    const metadata = prepareGrpcExecuteRequestMetadata(
      { 'x-trace': '1' },
      {
        type: 'oauth2',
        oauth2: {
          tokenUrl: 'https://auth.example.com/token',
          clientId: 'client',
          clientSecret: 'secret',
        },
      },
    );
    expect(metadata).toEqual({ 'x-trace': '1' });
    expect(prepareGrpcExecuteRequestMetadata(
      {},
      {
        type: 'oauth2',
        oauth2: {
          tokenUrl: 'https://auth.example.com/token',
          clientId: 'client',
          clientSecret: 'secret',
        },
      },
    )).toBeUndefined();
  });
});
