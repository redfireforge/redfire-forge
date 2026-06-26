/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { tauriGqlNativeFetch } from './tauriGqlNativeFetch';

const mockInvoke = vi.fn();

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}));

describe('tauriGqlNativeFetch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInvoke.mockResolvedValue({
      status: 200,
      statusText: 'OK',
      headers: { 'content-type': 'application/json' },
      body: '{"data":{}}',
    });
  });

  it('invokes gql_http_fetch with serialized TLS payload', async () => {
    await tauriGqlNativeFetch(
      'https://localhost:4445/graphql',
      'POST',
      { Accept: 'application/json' },
      '{"query":"{ health }"}',
      undefined,
      {
        caCert: '-----BEGIN CERTIFICATE-----\nca',
        clientCert: '-----BEGIN CERTIFICATE-----\nclient',
        clientKey: '-----BEGIN PRIVATE KEY-----\nkey',
      },
    );

    expect(mockInvoke).toHaveBeenCalledWith('gql_http_fetch', {
      request: expect.objectContaining({
        url: 'https://localhost:4445/graphql',
        method: 'POST',
        caCert: '-----BEGIN CERTIFICATE-----\nca',
        clientCert: '-----BEGIN CERTIFICATE-----\nclient',
        clientKey: '-----BEGIN PRIVATE KEY-----\nkey',
      }),
    });
  });

  it('returns Aborted when signal is already aborted', async () => {
    const ctrl = new AbortController();
    ctrl.abort();
    const result = await tauriGqlNativeFetch('https://x/graphql', 'POST', {}, '{}', ctrl.signal, {
      skipTlsVerify: true,
    });
    expect(result.error).toBe('Aborted');
    expect(mockInvoke).not.toHaveBeenCalled();
  });
});
