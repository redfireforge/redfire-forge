/**
 * @vitest-environment node
 */
import { describe, expect, it, vi } from 'vitest';

vi.mock('node:dns/promises', () => ({
  lookup: vi.fn(async () => [{ address: '93.184.216.34', family: 4 }]),
}));

import {
  ServerOutboundUrlPolicyError,
  validateServerOutboundUrl,
  validateServerOutboundUrlWithDns,
} from './serverOutboundUrlPolicy.js';

describe('serverOutboundUrlPolicy coverage gaps', () => {
  it('rejects invalid URLs and unsupported protocols', () => {
    expect(() => validateServerOutboundUrl('not-a-url'))
      .toThrow(/invalid outbound fetch url/i);
    expect(() => validateServerOutboundUrl('ftp://example.com/file'))
      .toThrow(/http or https/i);
  });

  it('blocks metadata.goog and private IPv4 host literals', () => {
    expect(() => validateServerOutboundUrl('https://metadata.goog/token'))
      .toThrow(/blocked for host/i);
    expect(() => validateServerOutboundUrl('https://10.0.0.1/token'))
      .toThrow(/private network/i);
  });

  it('blocks IPv6 literal hosts in URLs', () => {
    expect(() => validateServerOutboundUrl('https://[::1]/token'))
      .toThrow(/ipv6 literal hosts are not supported/i);
  });

  it('respects allowHttpLocalhost=false and blockHttpsLoopback=false options', () => {
    expect(() => validateServerOutboundUrl('http://localhost:8080/x', { allowHttpLocalhost: false }))
      .toThrow(/localhost in dev mode/i);
    expect(validateServerOutboundUrl('https://127.0.0.1/token', { blockHttpsLoopback: false }).hostname)
      .toBe('127.0.0.1');
  });

  it('skips DNS lookup for literal and localhost hosts', async () => {
    const resolver = vi.fn(async () => ['10.0.0.1']);
    await expect(validateServerOutboundUrlWithDns('https://93.184.216.34/token', { resolveHostname: resolver }))
      .resolves.toBeTruthy();
    await expect(validateServerOutboundUrlWithDns('http://localhost:8080/token', { resolveHostname: resolver }))
      .resolves.toBeTruthy();
    expect(resolver).not.toHaveBeenCalled();
  });

  it('returns early when skipDnsResolution is true', async () => {
    const resolver = vi.fn(async () => ['10.0.0.1']);
    await expect(validateServerOutboundUrlWithDns('https://safe.example.com/token', {
      skipDnsResolution: true,
      resolveHostname: resolver,
    })).resolves.toBeTruthy();
    expect(resolver).not.toHaveBeenCalled();
  });

  it('blocks DNS-resolved loopback and mapped private IPv4 addresses', async () => {
    await expect(validateServerOutboundUrlWithDns('https://safe.example.com/token', {
      resolveHostname: async () => ['127.0.0.2'],
    })).rejects.toThrow(/loopback address/i);

    await expect(validateServerOutboundUrlWithDns('https://safe.example.com/token', {
      resolveHostname: async () => ['::ffff:10.1.2.3'],
    })).rejects.toThrow(/private network address/i);
  });

  it('blocks DNS-resolved IPv6 loopback and link-local addresses', async () => {
    await expect(validateServerOutboundUrlWithDns('https://safe.example.com/token', {
      resolveHostname: async () => ['::1'],
    })).rejects.toThrow(/loopback address/i);

    await expect(validateServerOutboundUrlWithDns('https://safe.example.com/token', {
      resolveHostname: async () => ['fe80::1'],
    })).rejects.toThrow(/private network address/i);

    await expect(validateServerOutboundUrlWithDns('https://safe.example.com/token', {
      resolveHostname: async () => ['fd12::1'],
    })).rejects.toThrow(/private network address/i);
  });

  it('rejects empty DNS results and non-Error resolver failures', async () => {
    await expect(validateServerOutboundUrlWithDns('https://safe.example.com/token', {
      resolveHostname: async () => [],
    })).rejects.toThrow(/returned no addresses/i);

    await expect(validateServerOutboundUrlWithDns('https://safe.example.com/token', {
      resolveHostname: async () => { throw 'boom'; },
    })).rejects.toThrow(/dns resolution failed/i);
  });

  it('allows 127.0.0.1 over http localhost dev mode', () => {
    const url = validateServerOutboundUrl('http://127.0.0.1:8080/token');
    expect(url.hostname).toBe('127.0.0.1');
  });

  it('blocks DNS-resolved unspecified IPv6 addresses', async () => {
    await expect(validateServerOutboundUrlWithDns('https://safe.example.com/token', {
      resolveHostname: async () => ['::'],
    })).rejects.toThrow(/private network address/i);
  });

  it('resolves hostnames through the default DNS adapter', async () => {
    const resolved = await validateServerOutboundUrlWithDns('https://safe.example.com/token');
    expect(resolved.hostname).toBe('safe.example.com');
  });

  it('sets ServerOutboundUrlPolicyError name', () => {
    expect(new ServerOutboundUrlPolicyError('nope').name).toBe('ServerOutboundUrlPolicyError');
  });
});
