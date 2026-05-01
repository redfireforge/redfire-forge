import { describe, it, expect } from 'vitest';
import { resolveAuthHeaders } from './authHeaders';
import type { AuthConfig } from '../types';

describe('resolveAuthHeaders', () => {
  it('returns empty object for auth type "none"', () => {
    const auth: AuthConfig = { type: 'none' };
    expect(resolveAuthHeaders(auth)).toEqual({});
  });

  it('returns Basic header for basic auth', () => {
    const auth: AuthConfig = { type: 'basic', username: 'user', password: 'pass' };
    const result = resolveAuthHeaders(auth);
    expect(result['Authorization']).toBe(`Basic ${btoa('user:pass')}`);
  });

  it('handles basic auth with empty password', () => {
    const auth: AuthConfig = { type: 'basic', username: 'user' };
    const result = resolveAuthHeaders(auth);
    expect(result['Authorization']).toBe(`Basic ${btoa('user:')}`);
  });

  it('returns empty for basic auth without username', () => {
    const auth: AuthConfig = { type: 'basic', username: '' };
    expect(resolveAuthHeaders(auth)).toEqual({});
  });

  it('returns Bearer header with default prefix', () => {
    const auth: AuthConfig = { type: 'bearer', token: 'mytoken' };
    const result = resolveAuthHeaders(auth);
    expect(result['Authorization']).toBe('Bearer mytoken');
  });

  it('returns Bearer header with custom prefix', () => {
    const auth: AuthConfig = { type: 'bearer', token: 'mytoken', prefix: 'Token' };
    const result = resolveAuthHeaders(auth);
    expect(result['Authorization']).toBe('Token mytoken');
  });

  it('returns empty for bearer auth without token', () => {
    const auth: AuthConfig = { type: 'bearer', token: '' };
    expect(resolveAuthHeaders(auth)).toEqual({});
  });

  it('returns apikey header when apiKeyIn is header', () => {
    const auth: AuthConfig = { type: 'apikey', apiKeyName: 'X-API-Key', apiKeyValue: 'abc123', apiKeyIn: 'header' };
    const result = resolveAuthHeaders(auth);
    expect(result['X-API-Key']).toBe('abc123');
  });

  it('returns empty for apikey when apiKeyIn is query', () => {
    const auth: AuthConfig = { type: 'apikey', apiKeyName: 'key', apiKeyValue: 'val', apiKeyIn: 'query' };
    expect(resolveAuthHeaders(auth)).toEqual({});
  });

  it('returns empty for apikey without name or value', () => {
    const auth: AuthConfig = { type: 'apikey', apiKeyName: '', apiKeyValue: '', apiKeyIn: 'header' };
    expect(resolveAuthHeaders(auth)).toEqual({});
  });

  it('returns Basic header for digest auth', () => {
    const auth: AuthConfig = { type: 'digest', username: 'admin', password: 'secret' };
    const result = resolveAuthHeaders(auth);
    expect(result['Authorization']).toBe(`Basic ${btoa('admin:secret')}`);
  });

  it('returns Bearer header for oauth2 with token', () => {
    const auth: AuthConfig = { type: 'oauth2', tokenUrl: 'https://auth.example.com/token', clientId: 'id', clientSecret: 'secret' };
    const result = resolveAuthHeaders(auth, 'acquired-token');
    expect(result['Authorization']).toBe('Bearer acquired-token');
  });

  it('returns empty for oauth2 without token', () => {
    const auth: AuthConfig = { type: 'oauth2', tokenUrl: 'https://auth.example.com/token' };
    expect(resolveAuthHeaders(auth)).toEqual({});
  });

  it('returns only one header entry', () => {
    const auth: AuthConfig = { type: 'bearer', token: 'tok' };
    const result = resolveAuthHeaders(auth);
    expect(Object.keys(result)).toEqual(['Authorization']);
  });
});
