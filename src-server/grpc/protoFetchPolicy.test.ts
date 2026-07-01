/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest';
import { ProtoFetchPolicyError, protoPathFromFetchUrl, validateProtoFetchUrl } from './protoFetchPolicy.js';

describe('protoFetchPolicy', () => {
  it('accepts https URLs', () => {
    const url = validateProtoFetchUrl('https://example.com/schemas/echo.proto');
    expect(url.hostname).toBe('example.com');
    expect(protoPathFromFetchUrl(url)).toBe('echo.proto');
  });

  it('allows http localhost in dev mode', () => {
    const url = validateProtoFetchUrl('http://localhost:8080/echo.proto');
    expect(url.protocol).toBe('http:');
  });

  it('blocks http non-localhost', () => {
    expect(() => validateProtoFetchUrl('http://example.com/echo.proto'))
      .toThrow(ProtoFetchPolicyError);
  });

  it('blocks private network hosts', () => {
    expect(() => validateProtoFetchUrl('https://192.168.1.10/echo.proto'))
      .toThrow(/private network/i);
  });

  it('blocks https loopback hosts', () => {
    expect(() => validateProtoFetchUrl('https://127.0.0.1/echo.proto'))
      .toThrow(/loopback/i);
    expect(() => validateProtoFetchUrl('https://localhost/echo.proto'))
      .toThrow(/loopback/i);
  });

  it('blocks metadata endpoints', () => {
    expect(() => validateProtoFetchUrl('https://metadata.google.internal/echo.proto'))
      .toThrow(/blocked/i);
  });
});
