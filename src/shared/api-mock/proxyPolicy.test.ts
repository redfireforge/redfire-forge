import { describe, it, expect } from 'vitest';
import {
  checkProxyUrl, stripHopByHopHeaders, stripCredentialHeaders,
  addAntiRecursionHeader, hasAntiRecursionHeader, stripSetCookieFromResponse,
  type ProxyPolicyConfig,
} from './proxyPolicy';

const config: ProxyPolicyConfig = { allowedUpstreams: ['https://api.example.com', 'http://staging.internal:8080'] };

describe('checkProxyUrl', () => {
  it('allows URLs in the allowlist', () => {
    expect(checkProxyUrl('https://api.example.com/users', config, []).allowed).toBe(true);
  });

  it('rejects URLs not in allowlist', () => {
    const r = checkProxyUrl('https://evil.com/steal', config, []);
    expect(r.allowed).toBe(false);
    expect(r.reason).toContain('not in allowlist');
  });

  it('blocks cloud metadata endpoints', () => {
    expect(checkProxyUrl('http://169.254.169.254/latest/meta-data', config, []).allowed).toBe(false);
    expect(checkProxyUrl('http://metadata.google.internal/v1', config, []).allowed).toBe(false);
  });

  it('blocks private IPv4 ranges', () => {
    expect(checkProxyUrl('http://10.0.0.1/internal', config, []).allowed).toBe(false);
    expect(checkProxyUrl('http://192.168.1.1/admin', config, []).allowed).toBe(false);
    expect(checkProxyUrl('http://172.16.0.1/api', config, []).allowed).toBe(false);
  });

  it('blocks IPv6 loopback', () => {
    expect(checkProxyUrl('http://[::1]/test', config, []).allowed).toBe(false);
  });

  it('blocks self-recursion to active mock ports', () => {
    const r = checkProxyUrl('http://localhost:4600/test', { allowedUpstreams: ['http://localhost:4600'] }, [4600]);
    expect(r.allowed).toBe(false);
    expect(r.reason).toContain('Self-recursion');
  });

  it('blocks control plane port', () => {
    const r = checkProxyUrl('http://localhost:3001/api', { allowedUpstreams: ['http://localhost:3001'] }, []);
    expect(r.allowed).toBe(false);
    expect(r.reason).toContain('control plane');
  });

  it('rejects invalid URLs', () => {
    expect(checkProxyUrl('not-a-url', config, []).allowed).toBe(false);
  });

  it('rejects non-HTTP protocols', () => {
    expect(checkProxyUrl('ftp://example.com', config, []).allowed).toBe(false);
  });

  it('allows host+scheme match', () => {
    expect(checkProxyUrl('http://staging.internal:8080/v2/data', config, []).allowed).toBe(true);
  });
});

describe('stripHopByHopHeaders', () => {
  it('removes hop-by-hop headers', () => {
    const input = { 'Connection': 'keep-alive', 'Content-Type': 'application/json', 'Transfer-Encoding': 'chunked', 'Proxy-Connection': 'keep-alive', 'X-Custom': 'val' };
    const result = stripHopByHopHeaders(input);
    expect(result['Connection']).toBeUndefined();
    expect(result['Transfer-Encoding']).toBeUndefined();
    expect(result['Proxy-Connection']).toBeUndefined();
    expect(result['Content-Type']).toBe('application/json');
    expect(result['X-Custom']).toBe('val');
  });
});

describe('stripCredentialHeaders', () => {
  it('strips auth headers by default', () => {
    const input = { 'Authorization': 'Bearer tok', 'Cookie': 'a=b', 'X-Custom': 'yes' };
    const result = stripCredentialHeaders(input);
    expect(result['Authorization']).toBeUndefined();
    expect(result['Cookie']).toBeUndefined();
    expect(result['X-Custom']).toBe('yes');
  });

  it('preserves explicitly forwarded headers', () => {
    const input = { 'Authorization': 'Bearer tok', 'Cookie': 'a=b' };
    const result = stripCredentialHeaders(input, ['authorization']);
    expect(result['Authorization']).toBe('Bearer tok');
    expect(result['Cookie']).toBeUndefined();
  });
});

describe('anti-recursion header', () => {
  it('adds the header', () => {
    const result = addAntiRecursionHeader({ 'X-Custom': 'val' });
    expect(result['x-redfireforge-mock']).toBe('true');
  });

  it('detects the header', () => {
    expect(hasAntiRecursionHeader({ 'x-redfireforge-mock': 'true' })).toBe(true);
    expect(hasAntiRecursionHeader({ 'x-redfireforge-mock': ['true'] })).toBe(true);
    expect(hasAntiRecursionHeader({})).toBe(false);
  });
});

describe('stripSetCookieFromResponse', () => {
  it('strips Set-Cookie', () => {
    const input = { 'Set-Cookie': 'a=b', 'Content-Type': 'text/html' };
    const result = stripSetCookieFromResponse(input);
    expect(result['Set-Cookie']).toBeUndefined();
    expect(result['Content-Type']).toBe('text/html');
  });
});
