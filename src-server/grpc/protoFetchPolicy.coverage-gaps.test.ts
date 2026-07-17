/**
 * @vitest-environment node
 */
import { describe, expect, it, vi } from 'vitest';
import * as serverOutboundUrlPolicy from './serverOutboundUrlPolicy.js';
import { ProtoFetchPolicyError, protoPathFromFetchUrl, validateProtoFetchUrl } from './protoFetchPolicy.js';

describe('protoFetchPolicy coverage gaps', () => {
  it('protoPathFromFetchUrl appends .proto when basename lacks extension', () => {
    const url = new URL('https://example.com/schemas/echo');
    expect(protoPathFromFetchUrl(url)).toBe('echo.proto');
  });

  it('protoPathFromFetchUrl defaults to fetched.proto for empty paths', () => {
    expect(protoPathFromFetchUrl(new URL('https://example.com/'))).toBe('fetched.proto');
  });

  it('rethrows non-policy errors from validateServerOutboundUrl', () => {
    vi.spyOn(serverOutboundUrlPolicy, 'validateServerOutboundUrl').mockImplementation(() => {
      throw new TypeError('unexpected');
    });
    expect(() => validateProtoFetchUrl('https://example.com/echo.proto')).toThrow(TypeError);
    vi.restoreAllMocks();
  });

  it('wraps ServerOutboundUrlPolicyError in ProtoFetchPolicyError', () => {
    vi.spyOn(serverOutboundUrlPolicy, 'validateServerOutboundUrl').mockImplementation(() => {
      throw new serverOutboundUrlPolicy.ServerOutboundUrlPolicyError('blocked host');
    });
    expect(() => validateProtoFetchUrl('https://example.com/echo.proto'))
      .toThrow(ProtoFetchPolicyError);
    vi.restoreAllMocks();
  });
});
