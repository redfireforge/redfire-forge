import { describe, expect, it } from 'vitest';
import { GRPC_ERROR_CODES } from './contracts';
import {
  buildAuthMetadataHeaders,
  buildGrpcOAuth2PreviewMetadata,
  getGrpcAuthMetadataKeys,
  mergeGrpcExecuteMetadata,
  prepareGrpcExecuteRequestMetadata,
  validateGrpcAuthConfigContract,
  validateGrpcAuthForExecute,
} from './grpcAuthPolicy';

describe('grpcAuthPolicy coverage gaps', () => {
  it('buildAuthMetadataHeaders validates bearer, basic, and api key inputs', () => {
    expect(buildAuthMetadataHeaders({ type: 'bearer', bearerToken: '  ' })).toEqual({
      ok: false,
      error: 'Bearer token is required',
      field: 'auth.bearerToken',
    });
    expect(buildAuthMetadataHeaders({ type: 'basic', basicUsername: '' })).toEqual({
      ok: false,
      error: 'Basic auth username is required',
      field: 'auth.basicUsername',
    });
    expect(buildAuthMetadataHeaders({ type: 'api_key', apiKeyName: 'x-key', apiKeyValue: '' })).toEqual({
      ok: false,
      error: 'API key value is required',
      field: 'auth.apiKeyValue',
    });
  });

  it('buildAuthMetadataHeaders validates oauth2 required fields', () => {
    expect(buildAuthMetadataHeaders({
      type: 'oauth2',
      oauth2: { tokenUrl: '', clientId: 'id', clientSecret: 'sec' },
    })).toEqual({
      ok: false,
      error: 'OAuth2 token URL is required',
      field: 'auth.oauth2.tokenUrl',
    });
    expect(buildAuthMetadataHeaders({
      type: 'oauth2',
      oauth2: { tokenUrl: 'https://auth.example.com/token', clientId: '', clientSecret: 'sec' },
    })).toEqual({
      ok: false,
      error: 'OAuth2 client ID is required',
      field: 'auth.oauth2.clientId',
    });
    expect(buildAuthMetadataHeaders({
      type: 'oauth2',
      oauth2: { tokenUrl: 'https://auth.example.com/token', clientId: 'id', clientSecret: '' },
    })).toEqual({
      ok: false,
      error: 'OAuth2 client secret is required',
      field: 'auth.oauth2.clientSecret',
    });
  });

  it('mergeGrpcExecuteMetadata propagates auth build failures', () => {
    expect(mergeGrpcExecuteMetadata({}, { type: 'bearer', bearerToken: '' })).toEqual({
      ok: false,
      error: 'Bearer token is required',
      field: 'auth.bearerToken',
    });
  });

  it('buildGrpcOAuth2PreviewMetadata validates shape and merges preview authorization', () => {
    expect(buildGrpcOAuth2PreviewMetadata({}, { type: 'bearer', bearerToken: 'x' })).toEqual({
      ok: false,
      error: 'OAuth2 auth configuration is required',
      field: 'auth.type',
    });

    const preview = buildGrpcOAuth2PreviewMetadata(
      { authorization: 'Bearer manual' },
      {
        type: 'oauth2',
        oauth2: {
          tokenUrl: 'https://auth.example.com/token',
          clientId: 'id',
          clientSecret: 'sec',
        },
      },
    );
    expect(preview.ok).toBe(true);
    if (preview.ok) {
      expect(preview.metadata.authorization).toMatch(/Bearer/);
      expect(preview.conflicts).toHaveLength(1);
    }
  });

  it('getGrpcAuthMetadataKeys returns empty for failed auth builds', () => {
    expect(getGrpcAuthMetadataKeys({ type: 'bearer', bearerToken: '' })).toEqual([]);
  });

  it('validateGrpcAuthConfigContract flags unsupported auth type', () => {
    expect(validateGrpcAuthConfigContract({ type: 'unknown' as 'bearer' })).toEqual([
      expect.objectContaining({ field: 'auth.type' }),
    ]);
  });

  it('validateGrpcAuthForExecute surfaces header build failures for bearer auth', () => {
    expect(validateGrpcAuthForExecute({ type: 'bearer', bearerToken: '' })).toEqual([
      expect.objectContaining({ field: 'auth.bearerToken' }),
    ]);
  });

  it('validateGrpcAuthForExecute maps unsupported auth types via header builder', () => {
    expect(validateGrpcAuthForExecute({ type: 'custom' as 'bearer' })).toEqual([{
      field: 'auth',
      code: GRPC_ERROR_CODES.INVALID_REQUEST,
      message: 'Unsupported auth type: custom',
    }]);
  });

  it('prepareGrpcExecuteRequestMetadata throws when merge fails for non-oauth2 auth', () => {
    expect(() => prepareGrpcExecuteRequestMetadata({}, { type: 'bearer', bearerToken: '' }))
      .toThrow(/Bearer token is required/);
  });

  it('encodeBasicAuth uses Buffer when btoa is unavailable', () => {
    const originalBtoa = globalThis.btoa;
    // @ts-expect-error test override
    globalThis.btoa = undefined;
    const result = buildAuthMetadataHeaders({
      type: 'basic',
      basicUsername: 'alice',
      basicPassword: 'pass',
    });
    globalThis.btoa = originalBtoa;
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.metadata.authorization).toMatch(/^Basic /);
    }
  });

  it('returns empty metadata for none auth and validates api key header name', () => {
    expect(buildAuthMetadataHeaders(undefined)).toEqual({
      ok: true,
      metadata: {},
      authHeaders: {},
      conflicts: [],
    });
    expect(buildAuthMetadataHeaders({ type: 'none' })).toEqual({
      ok: true,
      metadata: {},
      authHeaders: {},
      conflicts: [],
    });
    expect(buildAuthMetadataHeaders({
      type: 'api_key',
      apiKeyName: '  ',
      apiKeyValue: 'secret',
    })).toEqual({
      ok: false,
      error: 'API key header name is required',
      field: 'auth.apiKeyName',
    });
  });

  it('returns server-side oauth2 execute message after field validation', () => {
    expect(buildAuthMetadataHeaders({
      type: 'oauth2',
      oauth2: {
        tokenUrl: 'https://auth.example.com/token',
        clientId: 'id',
        clientSecret: 'sec',
      },
    })).toEqual({
      ok: false,
      error: 'OAuth2 tokens are resolved server-side at execute time',
      field: 'auth.type',
    });
  });

  it('getGrpcAuthMetadataKeys uses authorization for oauth2-producing configs', () => {
    expect(getGrpcAuthMetadataKeys({
      type: 'oauth2',
      oauth2: {
        tokenUrl: 'https://auth.example.com/token',
        clientId: 'id',
        clientSecret: 'sec',
      },
    })).toEqual(['authorization']);
  });

  it('buildGrpcOAuth2PreviewMetadata returns first contract validation issue', () => {
    expect(buildGrpcOAuth2PreviewMetadata({}, {
      type: 'oauth2',
      oauth2: { tokenUrl: '', clientId: 'id', clientSecret: 'sec' },
    })).toEqual({
      ok: false,
      error: 'OAuth2 token URL is required',
      field: 'auth.oauth2.tokenUrl',
    });
  });

  it('prepareGrpcExecuteRequestMetadata passes manual metadata for oauth2 and omits empty merges', () => {
    expect(prepareGrpcExecuteRequestMetadata({ 'x-trace': '1' }, {
      type: 'oauth2',
      oauth2: {
        tokenUrl: 'https://auth.example.com/token',
        clientId: 'id',
        clientSecret: 'sec',
      },
    })).toEqual({ 'x-trace': '1' });
    expect(prepareGrpcExecuteRequestMetadata({}, { type: 'none' })).toBeUndefined();
    expect(prepareGrpcExecuteRequestMetadata({}, undefined)).toBeUndefined();
  });

  it('validateGrpcAuthConfigContract requires oauth2 client secret', () => {
    expect(validateGrpcAuthConfigContract({
      type: 'oauth2',
      oauth2: {
        tokenUrl: 'https://auth.example.com/token',
        clientId: 'id',
        clientSecret: '',
      },
    })).toEqual([
      expect.objectContaining({ field: 'auth.oauth2.clientSecret' }),
    ]);
  });

  it('validateGrpcAuthForExecute returns empty for valid basic auth', () => {
    expect(validateGrpcAuthForExecute({
      type: 'basic',
      basicUsername: 'alice',
      basicPassword: 'pass',
    })).toEqual([]);
  });

  it('mergeGrpcExecuteMetadata records manual/auth conflicts', () => {
    const merged = mergeGrpcExecuteMetadata(
      { authorization: 'Bearer manual' },
      { type: 'bearer', bearerToken: 'server-token' },
    );
    expect(merged.ok).toBe(true);
    if (merged.ok) {
      expect(merged.conflicts).toHaveLength(1);
      expect(merged.metadata.authorization).toBe('Bearer server-token');
    }
  });

  it('buildAuthMetadataHeaders rejects unsupported auth type in switch default', () => {
    expect(buildAuthMetadataHeaders({ type: 'custom' as 'bearer' })).toEqual({
      ok: false,
      error: 'Unsupported auth type: custom',
    });
  });

  it('mergeGrpcExecuteMetadata skips conflicts when manual metadata matches auth output', () => {
    const merged = mergeGrpcExecuteMetadata(
      { authorization: 'Bearer same-token' },
      { type: 'bearer', bearerToken: 'same-token' },
    );
    expect(merged.ok).toBe(true);
    if (merged.ok) {
      expect(merged.conflicts).toHaveLength(0);
      expect(merged.metadata.authorization).toBe('Bearer same-token');
    }
  });

  it('buildGrpcOAuth2PreviewMetadata skips conflict when manual authorization already matches preview', () => {
    const preview = buildGrpcOAuth2PreviewMetadata(
      { authorization: 'Bearer <server-acquired>' },
      {
        type: 'oauth2',
        oauth2: {
          tokenUrl: 'https://auth.example.com/token',
          clientId: 'id',
          clientSecret: 'sec',
        },
      },
    );
    expect(preview.ok).toBe(true);
    if (preview.ok) {
      expect(preview.conflicts).toHaveLength(0);
    }
  });

  it('getGrpcAuthMetadataKeys returns api key header names for valid api_key auth', () => {
    expect(getGrpcAuthMetadataKeys({
      type: 'api_key',
      apiKeyName: 'X-Api-Key',
      apiKeyValue: 'secret',
    })).toEqual(['x-api-key']);
  });

  it('builds basic auth with empty password and merges bearer metadata without manual conflicts', () => {
    expect(buildAuthMetadataHeaders({
      type: 'basic',
      basicUsername: 'alice',
      basicPassword: '',
    }).ok).toBe(true);
    const merged = mergeGrpcExecuteMetadata(
      { 'x-trace': '1' },
      { type: 'bearer', bearerToken: 'panel-token' },
    );
    expect(merged.ok).toBe(true);
    if (merged.ok) {
      expect(merged.metadata['x-trace']).toBe('1');
      expect(merged.conflicts).toHaveLength(0);
    }
  });

  it('validateGrpcAuthConfigContract accepts basic auth without password', () => {
    expect(validateGrpcAuthConfigContract({
      type: 'basic',
      basicUsername: 'alice',
    })).toEqual([]);
  });

  it('covers none/undefined auth guard branches across helpers', () => {
    expect(getGrpcAuthMetadataKeys(undefined)).toEqual([]);
    expect(getGrpcAuthMetadataKeys({ type: 'none' })).toEqual([]);
    expect(validateGrpcAuthConfigContract(undefined)).toEqual([]);
    expect(validateGrpcAuthForExecute(undefined)).toEqual([]);
    expect(validateGrpcAuthForExecute({ type: 'none' })).toEqual([]);
    expect(buildAuthMetadataHeaders({
      type: 'api_key',
      apiKeyName: 'x-api-key',
      apiKeyValue: '   ',
    })).toEqual({
      ok: false,
      error: 'API key value is required',
      field: 'auth.apiKeyValue',
    });
    expect(validateGrpcAuthForExecute({
      type: 'api_key',
      apiKeyName: 'x-api-key',
      apiKeyValue: 'secret',
    })).toEqual([]);
    expect(buildAuthMetadataHeaders({
      type: 'bearer',
      bearerToken: '  trimmed-token  ',
    }).ok).toBe(true);
    expect(validateGrpcAuthForExecute({
      type: 'bearer',
      bearerToken: 'token',
    })).toEqual([]);
    expect(prepareGrpcExecuteRequestMetadata({ '': 'ignored' }, { type: 'none' })).toBeUndefined();
    expect(getGrpcAuthMetadataKeys({
      type: 'basic',
      basicUsername: 'alice',
      basicPassword: 'pass',
    })).toEqual(['authorization']);
  });
});
