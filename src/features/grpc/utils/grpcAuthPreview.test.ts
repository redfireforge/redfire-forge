import { describe, expect, it } from 'vitest';
import { isGrpcAuthExecuteReady, previewGrpcAuthMerge } from './grpcAuthPreview';

describe('grpcAuthPreview (Phase 4C)', () => {
  it('merges bearer auth and detects authorization conflicts', () => {
    const preview = previewGrpcAuthMerge(
      { authorization: 'Bearer manual', 'x-trace': '1' },
      { type: 'bearer', bearerToken: 'server-token' },
    );
    expect(preview.ok).toBe(false);
    expect(preview.conflicts).toHaveLength(0);
    expect(preview.errorMessage).toMatch(/auth metadata conflicts/i);
    expect(preview.previewEntries).toHaveLength(0);
  });

  it('previews oauth2 as server-acquired authorization when shape is valid (Phase 4D)', () => {
    const preview = previewGrpcAuthMerge({}, {
      type: 'oauth2',
      oauth2: {
        tokenUrl: 'https://auth.example.com/token',
        clientId: 'id',
        clientSecret: 'secret',
      },
    });
    expect(preview.ok).toBe(true);
    expect(preview.previewEntries.find((entry) => entry.key === 'authorization')?.value).toBe('••••••');
    expect(isGrpcAuthExecuteReady({
      type: 'oauth2',
      oauth2: {
        tokenUrl: 'https://auth.example.com/token',
        clientId: 'id',
        clientSecret: 'secret',
      },
    })).toBe(true);
  });

  it('reports missing bearer token as not execute-ready', () => {
    const preview = previewGrpcAuthMerge({}, { type: 'bearer', bearerToken: '' });
    expect(preview.ok).toBe(false);
    expect(isGrpcAuthExecuteReady({ type: 'bearer', bearerToken: '' })).toBe(false);
  });

  it('marks preview as not ready when auth conflicts with manual metadata', () => {
    const preview = previewGrpcAuthMerge(
      { authorization: 'Bearer manual' },
      { type: 'bearer', bearerToken: 'panel-token' },
    );
    expect(preview.ok).toBe(false);
    expect(preview.errorMessage).toMatch(/auth metadata conflicts/i);
  });
});
