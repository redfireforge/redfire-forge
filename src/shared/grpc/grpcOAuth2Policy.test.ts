/**
 * Phase 4D — OAuth2 policy contract tests.
 */
import { describe, expect, it } from 'vitest';
import {
  buildGrpcOAuth2CacheKey,
  formatGrpcOAuth2TokenErrorMessage,
  mapGrpcOAuth2HttpFailure,
  normalizeGrpcOAuth2Credentials,
  oauth2ProducesAuthorizationHeader,
  parseGrpcOAuth2TokenExpiry,
  sanitizeGrpcOAuth2ErrorText,
} from './grpcOAuth2Policy';

describe('grpcOAuth2Policy (Phase 4D)', () => {
  it('builds stable cache keys including scope', () => {
    const keyA = buildGrpcOAuth2CacheKey({
      tokenUrl: 'https://auth.example.com/token',
      clientId: 'client',
      clientSecret: 'secret',
      scope: 'read',
    });
    const keyB = buildGrpcOAuth2CacheKey({
      tokenUrl: 'https://auth.example.com/token',
      clientId: 'client',
      clientSecret: 'secret',
      scope: 'write',
    });
    expect(keyA).not.toBe(keyB);
  });

  it('parses JWT exp when present', () => {
    const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({ exp: 4_000_000_000 })).toString('base64url');
    const token = `${header}.${payload}.sig`;
    expect(parseGrpcOAuth2TokenExpiry(token)).toBe(4_000_000_000);
  });

  it('maps invalid_client and invalid_scope responses', () => {
    expect(mapGrpcOAuth2HttpFailure(401, '{}').category).toBe('invalid_client');
    expect(mapGrpcOAuth2HttpFailure(400, JSON.stringify({
      error: 'invalid_scope',
      error_description: 'scope not allowed',
    })).message).toMatch(/invalid_scope/i);
    expect(mapGrpcOAuth2HttpFailure(401, JSON.stringify({
      error: 'invalid_scope',
      error_description: 'scope not allowed',
    })).category).toBe('invalid_scope');
  });

  it('sanitizes secret-like fragments from OAuth error text', () => {
    const sanitized = sanitizeGrpcOAuth2ErrorText(
      'client_secret=super-secret access_token=abc123 Bearer eyJhbG',
    );
    expect(sanitized).not.toContain('super-secret');
    expect(sanitized).not.toContain('abc123');
    expect(sanitized).toContain('[REDACTED]');
  });

  it('normalizes oauth2 credentials and returns undefined when empty', () => {
    expect(normalizeGrpcOAuth2Credentials(undefined)).toBeUndefined();
    expect(normalizeGrpcOAuth2Credentials({
      tokenUrl: '  ',
      clientId: '',
      clientSecret: '   ',
      scope: ' ',
    })).toBeUndefined();
    expect(normalizeGrpcOAuth2Credentials({
      tokenUrl: ' https://auth.example.com/token ',
      clientId: ' client ',
      clientSecret: 'secret',
      scope: ' read write ',
    })).toEqual({
      tokenUrl: 'https://auth.example.com/token',
      clientId: 'client',
      clientSecret: 'secret',
      scope: 'read write',
    });
    expect(normalizeGrpcOAuth2Credentials({
      tokenUrl: 'https://auth.example.com/token',
      clientId: 'client',
      clientSecret: 'secret',
      scope: '',
    })?.scope).toBeUndefined();
  });

  it('parseGrpcOAuth2TokenExpiry handles edge cases', () => {
    expect(parseGrpcOAuth2TokenExpiry('not-a-jwt')).toBeNull();
    expect(parseGrpcOAuth2TokenExpiry('header-only.')).toBeNull();
    const header = Buffer.from(JSON.stringify({ alg: 'none' })).toString('base64url');
    const payloadNoExp = Buffer.from(JSON.stringify({ sub: 'user' })).toString('base64url');
    expect(parseGrpcOAuth2TokenExpiry(`${header}.${payloadNoExp}.sig`)).toBeNull();
    const payloadBadExp = Buffer.from(JSON.stringify({ exp: 'not-a-number' })).toString('base64url');
    expect(parseGrpcOAuth2TokenExpiry(`${header}.${payloadBadExp}.sig`)).toBeNull();
    expect(parseGrpcOAuth2TokenExpiry('bad.payload!!!.sig')).toBeNull();
  });

  it('maps 500, 400, and unexpected responses from token endpoint', () => {
    expect(mapGrpcOAuth2HttpFailure(503, 'upstream error').category).toBe('endpoint_unreachable');
    expect(mapGrpcOAuth2HttpFailure(503, 'upstream error').message).toMatch(/503/);

    const badRequest = mapGrpcOAuth2HttpFailure(400, JSON.stringify({
      error: 'unsupported_grant_type',
      error_description: 'grant not supported',
    }));
    expect(badRequest.category).toBe('invalid_client');
    expect(badRequest.message).toMatch(/grant not supported/);

    expect(mapGrpcOAuth2HttpFailure(200, 'not json').category).toBe('invalid_response');
    expect(mapGrpcOAuth2HttpFailure(200, 'not json').message).toMatch(/unexpected response/i);
  });

  it('formatGrpcOAuth2TokenErrorMessage covers all categories', () => {
    expect(formatGrpcOAuth2TokenErrorMessage('invalid_client')).toMatch(/invalid_client/i);
    expect(formatGrpcOAuth2TokenErrorMessage('invalid_scope')).toMatch(/invalid_scope/i);
    expect(formatGrpcOAuth2TokenErrorMessage('timeout')).toMatch(/timed out/i);
    expect(formatGrpcOAuth2TokenErrorMessage('endpoint_unreachable')).toMatch(/unreachable/i);
    expect(formatGrpcOAuth2TokenErrorMessage('invalid_response')).toMatch(/invalid response/i);
    expect(formatGrpcOAuth2TokenErrorMessage('invalid_client', 'custom detail')).toBe('custom detail');
  });

  it('oauth2ProducesAuthorizationHeader is true only for oauth2 auth type', () => {
    expect(oauth2ProducesAuthorizationHeader(undefined)).toBe(false);
    expect(oauth2ProducesAuthorizationHeader({ type: 'bearer', bearerToken: 'x' })).toBe(false);
    expect(oauth2ProducesAuthorizationHeader({
      type: 'oauth2',
      oauth2: { tokenUrl: 'https://t', clientId: 'id', clientSecret: 'sec' },
    })).toBe(true);
  });
});
