/**
 * Phase 4D — OAuth2 policy coverage gaps.
 */
import { describe, expect, it, vi, afterEach } from 'vitest';
import {
  formatGrpcOAuth2TokenErrorMessage,
  mapGrpcOAuth2HttpFailure,
  parseGrpcOAuth2TokenExpiry,
} from './grpcOAuth2Policy';

describe('grpcOAuth2Policy coverage gaps', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('parseGrpcOAuth2TokenExpiry decodes via Buffer when atob is unavailable', () => {
    vi.stubGlobal('atob', undefined);
    const header = Buffer.from(JSON.stringify({ alg: 'none' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({ exp: 1_700_000_000 })).toString('base64url');
    expect(parseGrpcOAuth2TokenExpiry(`${header}.${payload}.sig`)).toBe(1_700_000_000);
  });

  it('mapGrpcOAuth2HttpFailure handles invalid_scope without description', () => {
    const result = mapGrpcOAuth2HttpFailure(400, JSON.stringify({ error: 'invalid_scope' }));
    expect(result.category).toBe('invalid_scope');
    expect(result.message).toMatch(/verify the requested scope/i);
  });

  it('mapGrpcOAuth2HttpFailure uses safe body slice for 400 responses', () => {
    const result = mapGrpcOAuth2HttpFailure(400, 'plain-text failure detail');
    expect(result.category).toBe('invalid_client');
    expect(result.message).toContain('plain-text failure detail');
  });

  it('formatGrpcOAuth2TokenErrorMessage falls back for unknown category', () => {
    // @ts-expect-error — exercise default switch branch
    expect(formatGrpcOAuth2TokenErrorMessage('unknown')).toMatch(/token request failed/i);
  });
});
