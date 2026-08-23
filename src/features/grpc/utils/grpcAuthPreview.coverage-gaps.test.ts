import { describe, expect, it, vi, beforeEach } from 'vitest';
import { isGrpcAuthExecuteReady, previewGrpcAuthMerge } from './grpcAuthPreview';

const actualAuthPolicy = vi.hoisted(async () => {
  return await vi.importActual<typeof import('../../../shared/grpc/grpcAuthPolicy')>(
    '../../../shared/grpc/grpcAuthPolicy',
  );
});

vi.mock('../../../shared/grpc/grpcAuthPolicy', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../shared/grpc/grpcAuthPolicy')>();
  return {
    ...actual,
    mergeGrpcExecuteMetadata: vi.fn(actual.mergeGrpcExecuteMetadata),
    buildGrpcOAuth2PreviewMetadata: vi.fn(actual.buildGrpcOAuth2PreviewMetadata),
  };
});

import { buildGrpcOAuth2PreviewMetadata, mergeGrpcExecuteMetadata } from '@shared/grpc/grpcAuthPolicy';

describe('grpcAuthPreview coverage gaps', () => {
  beforeEach(async () => {
    const actual = await actualAuthPolicy;
    vi.mocked(mergeGrpcExecuteMetadata).mockImplementation(actual.mergeGrpcExecuteMetadata);
    vi.mocked(buildGrpcOAuth2PreviewMetadata).mockImplementation(actual.buildGrpcOAuth2PreviewMetadata);
  });

  it('returns issues-only result for invalid bearer without merge errorMessage', () => {
    const preview = previewGrpcAuthMerge({}, { type: 'bearer', bearerToken: '' });
    expect(preview.ok).toBe(false);
    expect(preview.issues.length).toBeGreaterThan(0);
    expect(preview.errorMessage).toBeUndefined();
  });

  it('surfaces oauth2 validation issues when shape is invalid', () => {
    const preview = previewGrpcAuthMerge({}, {
      type: 'oauth2',
      oauth2: { tokenUrl: '', clientId: '', clientSecret: '' },
    });
    expect(preview.ok).toBe(false);
    expect(preview.issues.length).toBeGreaterThan(0);
    expect(preview.errorMessage).toBeUndefined();
  });

  it('masks whitespace-only secret metadata keys as empty in preview entries', () => {
    const preview = previewGrpcAuthMerge(
      { 'x-api-key': '   ' },
      { type: 'bearer', bearerToken: 'tok' },
    );
    expect(preview.previewEntries.find((entry) => entry.key === 'x-api-key')?.value).toBe('');
  });

  it('reports api_key validation issues when value is missing', () => {
    const preview = previewGrpcAuthMerge({}, {
      type: 'api_key',
      apiKeyName: 'x-api-key',
      apiKeyValue: '',
    });
    expect(preview.ok).toBe(false);
    expect(preview.issues.some((issue) => issue.field === 'auth.apiKeyValue')).toBe(true);
  });

  it('isGrpcAuthExecuteReady accepts none auth', () => {
    expect(isGrpcAuthExecuteReady(undefined)).toBe(true);
    expect(isGrpcAuthExecuteReady({ type: 'none' })).toBe(true);
  });

  it('sorts preview entries alphabetically', () => {
    const preview = previewGrpcAuthMerge(
      { 'z-custom': '1', authorization: 'Bearer x' },
      { type: 'bearer', bearerToken: 'tok' },
    );
    const keys = preview.previewEntries.map((entry) => entry.key);
    expect(keys).toEqual([...keys].sort((a, b) => a.localeCompare(b)));
  });

  it('returns oauth2 preview entries and blocks when a manual/auth conflict is present', () => {
    const preview = previewGrpcAuthMerge(
      { 'z-custom': '1', authorization: 'Bearer manual' },
      {
        type: 'oauth2',
        oauth2: {
          tokenUrl: 'https://auth.example.com/token',
          clientId: 'client-id',
          clientSecret: 'client-secret',
          scope: 'read',
        },
      },
    );
    expect(preview.previewEntries.some((entry) => entry.key === 'authorization')).toBe(true);
    expect(preview.previewEntries.map((entry) => entry.key)).toEqual(
      [...preview.previewEntries.map((entry) => entry.key)].sort((a, b) => a.localeCompare(b)),
    );
    expect(preview.conflicts).toHaveLength(1);
    expect(preview.ok).toBe(false);
    expect(preview.issues.some((issue) => /conflicts with manual metadata/i.test(issue.message))).toBe(true);
  });

  it('surfaces validation issues when oauth2 config is absent', () => {
    const preview = previewGrpcAuthMerge({}, {
      type: 'oauth2',
      oauth2: undefined,
    });
    expect(preview.ok).toBe(false);
    expect(preview.issues.some((issue) => /oauth2/i.test(issue.message))).toBe(true);
  });

  it('reports basic auth validation issues when username is missing', () => {
    const preview = previewGrpcAuthMerge({}, {
      type: 'basic',
      basicUsername: '',
      basicPassword: 'secret',
    });
    expect(preview.ok).toBe(false);
    expect(preview.issues.some((issue) => issue.field === 'auth.basicUsername')).toBe(true);
  });

  it('isGrpcAuthExecuteReady rejects incomplete bearer auth', () => {
    expect(isGrpcAuthExecuteReady({ type: 'bearer', bearerToken: '' })).toBe(false);
  });

  it('returns merge errorMessage when auth validates but merge fails', () => {
    vi.mocked(mergeGrpcExecuteMetadata).mockReturnValueOnce({
      ok: false,
      error: 'Bearer secret leaked in merge',
    });
    const preview = previewGrpcAuthMerge({}, {
      type: 'bearer',
      bearerToken: 'tok',
    });
    expect(preview.ok).toBe(false);
    expect(preview.errorMessage).toContain('[REDACTED]');
    expect(preview.previewEntries).toEqual([]);
  });

  it('returns basic auth preview entries when configuration is valid', () => {
    const preview = previewGrpcAuthMerge({}, {
      type: 'basic',
      basicUsername: 'user',
      basicPassword: 'secret',
    });
    expect(preview.ok).toBe(true);
    expect(preview.previewEntries.some((entry) => entry.key === 'authorization')).toBe(true);
  });

  it('returns api_key preview entries when configuration is valid', () => {
    const preview = previewGrpcAuthMerge({}, {
      type: 'api_key',
      apiKeyName: 'x-api-key',
      apiKeyValue: 'secret',
    });
    expect(preview.ok).toBe(true);
    expect(preview.previewEntries.some((entry) => entry.key === 'x-api-key')).toBe(true);
  });

  it('shows non-secret metadata values without masking in preview entries', () => {
    const preview = previewGrpcAuthMerge(
      { 'x-tenant': 'acme' },
      { type: 'bearer', bearerToken: 'tok' },
    );
    expect(preview.previewEntries.find((entry) => entry.key === 'x-tenant')?.value).toBe('acme');
  });

  it('isGrpcAuthExecuteReady rejects incomplete basic and api_key auth', () => {
    expect(isGrpcAuthExecuteReady({ type: 'basic', basicUsername: '', basicPassword: 'x' })).toBe(false);
    expect(isGrpcAuthExecuteReady({ type: 'api_key', apiKeyName: 'k', apiKeyValue: '' })).toBe(false);
  });

  it('shows masked authorization values for secret metadata keys', () => {
    const preview = previewGrpcAuthMerge(
      { authorization: 'Bearer visible-token-value' },
      { type: 'none' },
    );
    expect(preview.previewEntries.find((entry) => entry.key === 'authorization')?.value).toBe('••••••');
  });

  it('returns sanitized oauth2 preview errorMessage when preview fails without auth issues', () => {
    vi.mocked(buildGrpcOAuth2PreviewMetadata).mockReturnValueOnce({
      ok: false,
      error: 'Bearer secret-token leaked',
    });
    const preview = previewGrpcAuthMerge({}, {
      type: 'oauth2',
      oauth2: {
        tokenUrl: 'https://auth.example.com/token',
        clientId: 'client-id',
        clientSecret: 'client-secret',
      },
    });
    expect(preview.ok).toBe(false);
    expect(preview.errorMessage).toContain('[REDACTED]');
    expect(preview.previewEntries).toEqual([]);
  });

  it('masks secret manual metadata for none auth using merge path', () => {
    const preview = previewGrpcAuthMerge(
      { 'x-api-key': 'manual-secret' },
      { type: 'none' },
    );
    expect(preview.previewEntries.find((entry) => entry.key === 'x-api-key')?.value).toBe('••••••');
  });
});
