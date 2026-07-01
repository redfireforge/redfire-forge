import { describe, expect, it } from 'vitest';
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
});
