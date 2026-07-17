/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest';
import {
  OAuthTokenFetchPolicyError,
  validateOAuthTokenUrl,
  validateOAuthTokenUrlWithDns,
} from './oauthTokenFetchPolicy.js';

describe('oauthTokenFetchPolicy', () => {
  it('accepts public https token URLs', () => {
    const url = validateOAuthTokenUrl('https://auth.example.com/oauth/token');
    expect(url.hostname).toBe('auth.example.com');
  });

  it('allows http localhost for dev token servers', () => {
    const url = validateOAuthTokenUrl('http://localhost:8080/oauth/token');
    expect(url.protocol).toBe('http:');
  });

  it('blocks http non-localhost', () => {
    expect(() => validateOAuthTokenUrl('http://auth.example.com/token'))
      .toThrow(OAuthTokenFetchPolicyError);
  });

  it('blocks private network hosts', () => {
    expect(() => validateOAuthTokenUrl('https://192.168.1.10/token'))
      .toThrow(/private network/i);
  });

  it('blocks metadata endpoints', () => {
    expect(() => validateOAuthTokenUrl('https://metadata.google.internal/token'))
      .toThrow(/blocked/i);
  });

  it('blocks embedded credentials in OAuth token URLs', () => {
    expect(() => validateOAuthTokenUrl('https://client:secret@auth.example.com/token'))
      .toThrow(/embedded credentials/i);
  });

  it('blocks DNS-resolved private addresses for token URLs', async () => {
    await expect(validateOAuthTokenUrlWithDns('https://auth.example.com/oauth/token', {
      resolveHostname: async () => ['192.168.3.9'],
    })).rejects.toThrow(OAuthTokenFetchPolicyError);
  });
});
