/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { AuthConfig } from '@shared/types';

const mockAcquire = vi.fn();
vi.mock('@engine/core/tokenManager', () => ({
  acquireOAuth2Token: (...args: unknown[]) => mockAcquire(...args),
}));

import { useAuthVerify } from './useAuthVerify';

beforeEach(() => {
  mockAcquire.mockReset();
});

function makeJwt(payload: Record<string, unknown>): string {
  const enc = (o: object) => btoa(JSON.stringify(o));
  return `${enc({ alg: 'HS256' })}.${enc(payload)}.sig`;
}

describe('useAuthVerify', () => {
  it('starts idle', () => {
    const { result } = renderHook(() => useAuthVerify());
    expect(result.current.authVerifying).toBe(false);
    expect(result.current.authVerifyResult).toBeNull();
  });

  it('reports missing fields for oauth2', async () => {
    const { result } = renderHook(() => useAuthVerify());
    await act(async () => {
      await result.current.verifyAuth({ type: 'oauth2' } as AuthConfig);
    });
    expect(result.current.authVerifyResult?.ok).toBe(false);
    expect(result.current.authVerifyResult?.message).toContain('Token URL');
  });

  it('acquires an oauth2 token and parses JWT exp/scope', async () => {
    mockAcquire.mockResolvedValue(makeJwt({ exp: 1700000000, scope: 'read' }));
    const { result } = renderHook(() => useAuthVerify());
    await act(async () => {
      await result.current.verifyAuth({ type: 'oauth2', tokenUrl: 'u', clientId: 'c', clientSecret: 's' } as AuthConfig);
    });
    expect(result.current.authVerifyResult?.ok).toBe(true);
    expect(result.current.authVerifyResult?.detail).toContain('Expires');
    expect(result.current.authVerifyResult?.detail).toContain('Scope: read');
  });

  it('handles a non-JWT oauth2 token', async () => {
    mockAcquire.mockResolvedValue('opaque-token-value');
    const { result } = renderHook(() => useAuthVerify());
    await act(async () => {
      await result.current.verifyAuth({ type: 'oauth2', tokenUrl: 'u', clientId: 'c', clientSecret: 's' } as AuthConfig);
    });
    expect(result.current.authVerifyResult?.ok).toBe(true);
  });

  it('reports an error when token acquisition throws', async () => {
    mockAcquire.mockRejectedValue(new Error('boom'));
    const { result } = renderHook(() => useAuthVerify());
    await act(async () => {
      await result.current.verifyAuth({ type: 'oauth2', tokenUrl: 'u', clientId: 'c', clientSecret: 's' } as AuthConfig);
    });
    expect(result.current.authVerifyResult?.ok).toBe(false);
    expect(result.current.authVerifyResult?.message).toContain('boom');
  });

  it('validates basic auth', async () => {
    const { result } = renderHook(() => useAuthVerify());
    await act(async () => { await result.current.verifyAuth({ type: 'basic' } as AuthConfig); });
    expect(result.current.authVerifyResult?.ok).toBe(false);
    await act(async () => { await result.current.verifyAuth({ type: 'basic', username: 'u' } as AuthConfig); });
    expect(result.current.authVerifyResult?.ok).toBe(true);
  });

  it('validates bearer auth with default and custom prefix', async () => {
    const { result } = renderHook(() => useAuthVerify());
    await act(async () => { await result.current.verifyAuth({ type: 'bearer' } as AuthConfig); });
    expect(result.current.authVerifyResult?.ok).toBe(false);
    await act(async () => { await result.current.verifyAuth({ type: 'bearer', token: 'abc' } as AuthConfig); });
    expect(result.current.authVerifyResult?.detail).toContain('Bearer');
    await act(async () => { await result.current.verifyAuth({ type: 'bearer', token: 'abc', prefix: 'Token' } as AuthConfig); });
    expect(result.current.authVerifyResult?.detail).toContain('Token');
  });

  it('validates api key auth in header and query', async () => {
    const { result } = renderHook(() => useAuthVerify());
    await act(async () => { await result.current.verifyAuth({ type: 'apikey' } as AuthConfig); });
    expect(result.current.authVerifyResult?.ok).toBe(false);
    await act(async () => { await result.current.verifyAuth({ type: 'apikey', apiKeyName: 'X', apiKeyValue: 'v', apiKeyIn: 'query' } as AuthConfig); });
    expect(result.current.authVerifyResult?.detail).toContain('Query Param');
    await act(async () => { await result.current.verifyAuth({ type: 'apikey', apiKeyName: 'X', apiKeyValue: 'v' } as AuthConfig); });
    expect(result.current.authVerifyResult?.detail).toContain('Header');
  });

  it('validates digest auth', async () => {
    const { result } = renderHook(() => useAuthVerify());
    await act(async () => { await result.current.verifyAuth({ type: 'digest' } as AuthConfig); });
    expect(result.current.authVerifyResult?.ok).toBe(false);
    await act(async () => { await result.current.verifyAuth({ type: 'digest', username: 'u' } as AuthConfig); });
    expect(result.current.authVerifyResult?.ok).toBe(true);
  });

  it('reports no auth type for unknown/none', async () => {
    const { result } = renderHook(() => useAuthVerify());
    await act(async () => { await result.current.verifyAuth({ type: 'none' } as AuthConfig); });
    expect(result.current.authVerifyResult?.message).toBe('No auth type selected');
  });

  it('allows clearing the result', async () => {
    const { result } = renderHook(() => useAuthVerify());
    await act(async () => { await result.current.verifyAuth({ type: 'none' } as AuthConfig); });
    act(() => result.current.setAuthVerifyResult(null));
    expect(result.current.authVerifyResult).toBeNull();
  });
});
