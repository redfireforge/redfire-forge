/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest';
import {
  ServerOutboundUrlPolicyError,
  validateServerOutboundUrl,
  validateServerOutboundUrlWithDns,
} from './serverOutboundUrlPolicy.js';

describe('serverOutboundUrlPolicy', () => {
  it('accepts https URLs to public hosts', () => {
    const url = validateServerOutboundUrl('https://example.com/resource');
    expect(url.hostname).toBe('example.com');
  });

  it('allows http localhost in dev mode', () => {
    const url = validateServerOutboundUrl('http://localhost:8080/resource');
    expect(url.protocol).toBe('http:');
  });

  it('blocks http non-localhost', () => {
    expect(() => validateServerOutboundUrl('http://example.com/resource'))
      .toThrow(ServerOutboundUrlPolicyError);
  });

  it('blocks embedded credentials in outbound URLs', () => {
    expect(() => validateServerOutboundUrl('https://user:pass@auth.example.com/token'))
      .toThrow(/embedded credentials/i);
  });

  it('blocks https loopback hosts across the 127.0.0.0/8 range', () => {
    expect(() => validateServerOutboundUrl('https://127.0.0.2/token'))
      .toThrow(/loopback/i);
  });

  it('blocks metadata endpoints with trailing-dot hostnames', () => {
    expect(() => validateServerOutboundUrl('https://metadata.google.internal./token'))
      .toThrow(/blocked for host/i);
  });

  it('blocks DNS-resolved private IPv4 addresses', async () => {
    await expect(validateServerOutboundUrlWithDns('https://safe.example.com/token', {
      resolveHostname: async () => ['10.10.1.7'],
    })).rejects.toThrow(/private network address/i);
  });

  it('blocks DNS-resolved private IPv6 addresses', async () => {
    await expect(validateServerOutboundUrlWithDns('https://safe.example.com/token', {
      resolveHostname: async () => ['fd12::1'],
    })).rejects.toThrow(/private network address/i);
  });

  it('accepts DNS-resolved public addresses', async () => {
    const resolved = await validateServerOutboundUrlWithDns('https://safe.example.com/token', {
      resolveHostname: async () => ['93.184.216.34'],
    });
    expect(resolved.hostname).toBe('safe.example.com');
  });

  it('surfaces DNS resolver failures as policy errors', async () => {
    await expect(validateServerOutboundUrlWithDns('https://safe.example.com/token', {
      resolveHostname: async () => {
        throw new Error('NXDOMAIN');
      },
    })).rejects.toThrow(/dns resolution failed/i);
  });
});
