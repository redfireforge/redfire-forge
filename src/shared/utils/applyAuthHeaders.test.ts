import { describe, it, expect, vi, beforeEach } from 'vitest';
import { applyAuthHeaders } from './applyAuthHeaders';
import type { AuthConfig } from '../types';

// Mock dependencies
vi.mock('./authHeaders', () => ({
  resolveAuthHeaders: vi.fn((auth: AuthConfig, token?: string) => {
    if (token) return { Authorization: `Bearer ${token}` };
    if (auth.type === 'bearer') return { Authorization: `Bearer ${(auth as { type: 'bearer'; token: string }).token}` };
    if (auth.type === 'basic') return { Authorization: 'Basic dXNlcjpwYXNz' };
    if (auth.type === 'apikey') {
      const apiKeyAuth = auth as { type: 'apikey'; key?: string; value?: string };
      return { [apiKeyAuth.key || 'X-API-Key']: apiKeyAuth.value || 'key123' };
    }
    return {};
  }),
}));

vi.mock('../../engine/tokenManager', () => ({
  acquireOAuth2Token: vi.fn().mockResolvedValue('mock-oauth2-token'),
}));

describe('applyAuthHeaders', () => {
  beforeEach(() => {
    resetAllMocks();
  });

  it('returns headers unchanged for auth type "none"', async () => {
    const headers = { 'Content-Type': 'application/json' };
    const result = await applyAuthHeaders({ type: 'none' }, headers);
    expect(result).toBe(headers);
    expect(result).toEqual({ 'Content-Type': 'application/json' });
  });

  it('returns headers unchanged for auth type "inherit"', async () => {
    const headers = { Accept: '*/*' };
    const result = await applyAuthHeaders({ type: 'inherit' }, headers);
    expect(result).toBe(headers);
    expect(result).toEqual({ Accept: '*/*' });
  });

  it('applies bearer auth headers', async () => {
    const headers: Record<string, string> = {};
    const result = await applyAuthHeaders({ type: 'bearer', token: 'my-token' } as AuthConfig, headers);
    expect(result.Authorization).toBe('Bearer my-token');
  });

  it('applies basic auth headers', async () => {
    const headers: Record<string, string> = {};
    const result = await applyAuthHeaders({ type: 'basic', username: 'user', password: 'pass' } as AuthConfig, headers);
    expect(result.Authorization).toBe('Basic dXNlcjpwYXNz');
  });

  it('acquires OAuth2 token and applies headers', async () => {
    const { acquireOAuth2Token } = await import('../../engine/tokenManager');
    const headers: Record<string, string> = {};
    const auth: AuthConfig = { type: 'oauth2', tokenUrl: 'https://auth.example.com/token' } as AuthConfig;
    const result = await applyAuthHeaders(auth, headers);
    expect(acquireOAuth2Token).toHaveBeenCalledWith(auth);
    expect(result.Authorization).toBe('Bearer mock-oauth2-token');
  });

  it('skips OAuth2 when no tokenUrl', async () => {
    const { resolveAuthHeaders } = await import('./authHeaders');
    const headers: Record<string, string> = {};
    await applyAuthHeaders({ type: 'oauth2' } as AuthConfig, headers);
    expect(resolveAuthHeaders).toHaveBeenCalledWith({ type: 'oauth2' });
  });

  it('merges into existing headers without overwriting', async () => {
    const headers: Record<string, string> = { 'X-Custom': 'value' };
    await applyAuthHeaders({ type: 'bearer', token: 'tk' } as AuthConfig, headers);
    expect(headers['X-Custom']).toBe('value');
    expect(headers.Authorization).toBe('Bearer tk');
  });

  it('returns the same headers object (mutates in place)', async () => {
    const headers: Record<string, string> = {};
    const result = await applyAuthHeaders({ type: 'bearer', token: 'x' } as AuthConfig, headers);
    expect(result).toBe(headers);
  });
});
