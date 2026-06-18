/**
 * authUtils.test.ts — unit tests for GraphQL auth utilities.
 */

import { describe, it, expect } from 'vitest';
import { buildAuthHeaders, authBadgeLabel, isAuthConfigured } from './authUtils';
import type { GraphqlAuth } from '../../../shared/types/graphql';

// ─── buildAuthHeaders ─────────────────────────────────────────────────────────

describe('buildAuthHeaders', () => {
  it('returns empty object for null/undefined', () => {
    expect(buildAuthHeaders(null)).toEqual({});
    expect(buildAuthHeaders(undefined)).toEqual({});
  });

  it('returns Authorization: Bearer <token> for bearer type', () => {
    const headers = buildAuthHeaders({ type: 'bearer', token: 'my-secret-token' });
    expect(headers).toEqual({ Authorization: 'Bearer my-secret-token' });
  });

  it('trims bearer token before building header', () => {
    const headers = buildAuthHeaders({ type: 'bearer', token: '  tok  ' });
    expect(headers).toEqual({ Authorization: 'Bearer tok' });
  });

  it('returns empty object for bearer with missing/empty token', () => {
    expect(buildAuthHeaders({ type: 'bearer' })).toEqual({});
    expect(buildAuthHeaders({ type: 'bearer', token: '' })).toEqual({});
    expect(buildAuthHeaders({ type: 'bearer', token: '  ' })).toEqual({});
  });

  it('builds Basic auth header correctly', () => {
    const headers = buildAuthHeaders({ type: 'basic', username: 'alice', password: 'pass123' });
    expect(headers.Authorization).toMatch(/^Basic /);
    const decoded = atob(headers.Authorization.replace('Basic ', ''));
    expect(decoded).toBe('alice:pass123');
  });

  it('returns empty object for basic with missing username', () => {
    expect(buildAuthHeaders({ type: 'basic', password: 'x' })).toEqual({});
    expect(buildAuthHeaders({ type: 'basic', username: '  ' })).toEqual({});
  });

  it('handles empty password for basic auth', () => {
    const headers = buildAuthHeaders({ type: 'basic', username: 'user', password: '' });
    const decoded = atob(headers.Authorization.replace('Basic ', ''));
    expect(decoded).toBe('user:');
  });

  it('builds apiKey header correctly', () => {
    const headers = buildAuthHeaders({ type: 'apiKey', headerName: 'X-API-Key', headerValue: 'key123' });
    expect(headers).toEqual({ 'X-API-Key': 'key123' });
  });

  it('returns empty for apiKey with missing headerName', () => {
    expect(buildAuthHeaders({ type: 'apiKey', headerValue: 'val' })).toEqual({});
    expect(buildAuthHeaders({ type: 'apiKey', headerName: '' })).toEqual({});
  });

  it('returns empty for oauth2 and custom types', () => {
    expect(buildAuthHeaders({ type: 'oauth2' })).toEqual({});
    expect(buildAuthHeaders({ type: 'custom' })).toEqual({});
  });
});

// ─── authBadgeLabel ───────────────────────────────────────────────────────────

describe('authBadgeLabel', () => {
  it('returns "No Auth" for null/undefined', () => {
    expect(authBadgeLabel(null)).toBe('No Auth');
    expect(authBadgeLabel(undefined)).toBe('No Auth');
  });

  const cases: [GraphqlAuth['type'], string][] = [
    ['bearer', 'Bearer'],
    ['basic', 'Basic'],
    ['apiKey', 'API Key'],
    ['oauth2', 'OAuth 2.0'],
    ['custom', 'Custom'],
  ];

  it.each(cases)('returns %s label for %s auth type', (type, expected) => {
    expect(authBadgeLabel({ type })).toBe(expected);
  });
});

// ─── isAuthConfigured ─────────────────────────────────────────────────────────

describe('isAuthConfigured', () => {
  it('returns false for null/undefined', () => {
    expect(isAuthConfigured(null)).toBe(false);
    expect(isAuthConfigured(undefined)).toBe(false);
  });

  it('returns true for bearer with non-empty token', () => {
    expect(isAuthConfigured({ type: 'bearer', token: 'abc' })).toBe(true);
  });

  it('returns false for bearer with empty/missing token', () => {
    expect(isAuthConfigured({ type: 'bearer' })).toBe(false);
    expect(isAuthConfigured({ type: 'bearer', token: '' })).toBe(false);
    expect(isAuthConfigured({ type: 'bearer', token: '  ' })).toBe(false);
  });

  it('returns true for basic with non-empty username', () => {
    expect(isAuthConfigured({ type: 'basic', username: 'alice' })).toBe(true);
  });

  it('returns false for basic with empty username', () => {
    expect(isAuthConfigured({ type: 'basic' })).toBe(false);
    expect(isAuthConfigured({ type: 'basic', username: '' })).toBe(false);
  });

  it('returns true for apiKey with non-empty headerName', () => {
    expect(isAuthConfigured({ type: 'apiKey', headerName: 'X-Api-Key' })).toBe(true);
  });

  it('returns false for apiKey with empty headerName', () => {
    expect(isAuthConfigured({ type: 'apiKey' })).toBe(false);
    expect(isAuthConfigured({ type: 'apiKey', headerName: '' })).toBe(false);
  });

  it('returns true for oauth2 and custom (user explicitly chose a type)', () => {
    expect(isAuthConfigured({ type: 'oauth2' })).toBe(true);
    expect(isAuthConfigured({ type: 'custom' })).toBe(true);
  });
});
