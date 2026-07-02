/**
 * @vitest-environment node
 */
import { describe, expect, it, vi } from 'vitest';
import * as serverOutboundUrlPolicy from './serverOutboundUrlPolicy.js';
import { OAuthTokenFetchPolicyError, validateOAuthTokenUrl, validateOAuthTokenUrlWithDns } from './oauthTokenFetchPolicy.js';

describe('oauthTokenFetchPolicy coverage gaps', () => {
  it('blocks https loopback token endpoints', () => {
    expect(() => validateOAuthTokenUrl('https://127.0.0.1/token'))
      .toThrow(OAuthTokenFetchPolicyError);
    expect(() => validateOAuthTokenUrl('https://localhost/token'))
      .toThrow(/loopback/i);
  });

  it('rethrows non-policy errors from validateServerOutboundUrl', () => {
    vi.spyOn(serverOutboundUrlPolicy, 'validateServerOutboundUrl').mockImplementation(() => {
      throw new Error('dns failure');
    });
    expect(() => validateOAuthTokenUrl('https://auth.example.com/token')).toThrow('dns failure');
    vi.restoreAllMocks();
  });

  it('rethrows non-policy errors from validateServerOutboundUrlWithDns', async () => {
    vi.spyOn(serverOutboundUrlPolicy, 'validateServerOutboundUrlWithDns').mockRejectedValue(new Error('unexpected'));
    await expect(validateOAuthTokenUrlWithDns('https://auth.example.com/token'))
      .rejects.toThrow('unexpected');
    vi.restoreAllMocks();
  });

  it('wraps DNS-resolved private addresses as OAuthTokenFetchPolicyError', async () => {
    await expect(validateOAuthTokenUrlWithDns('https://auth.example.com/token', {
      resolveHostname: async () => ['10.0.0.5'],
    })).rejects.toBeInstanceOf(OAuthTokenFetchPolicyError);
  });

  it('accepts DNS-resolved public addresses for token URLs', async () => {
    const url = await validateOAuthTokenUrlWithDns('https://auth.example.com/token', {
      resolveHostname: async () => ['93.184.216.34'],
    });
    expect(url.hostname).toBe('auth.example.com');
  });

  it('sets OAuthTokenFetchPolicyError name', () => {
    expect(new OAuthTokenFetchPolicyError('nope').name).toBe('OAuthTokenFetchPolicyError');
  });
});
