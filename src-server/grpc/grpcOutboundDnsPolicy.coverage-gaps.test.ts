/**
 * @vitest-environment node
 */
import { afterEach, describe, expect, it } from 'vitest';
import {
  configureGrpcOutboundDnsPolicy,
  isGrpcOutboundDnsStrictEnabled,
  resetGrpcOutboundDnsPolicyForTests,
} from './grpcOutboundDnsPolicy.js';

describe('grpcOutboundDnsPolicy coverage gaps', () => {
  const originalEnv = process.env.GRPC_OUTBOUND_DNS_STRICT;

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.GRPC_OUTBOUND_DNS_STRICT;
    } else {
      process.env.GRPC_OUTBOUND_DNS_STRICT = originalEnv;
    }
    resetGrpcOutboundDnsPolicyForTests();
  });

  it.each([
    ['0', false],
    ['false', false],
    ['off', false],
    ['no', false],
    ['1', true],
    ['true', true],
    ['on', true],
    ['yes', true],
  ] as const)('parses GRPC_OUTBOUND_DNS_STRICT=%s as %s', (value, expected) => {
    process.env.GRPC_OUTBOUND_DNS_STRICT = value;
    resetGrpcOutboundDnsPolicyForTests();
    expect(isGrpcOutboundDnsStrictEnabled()).toBe(expected);
  });

  it('falls back to default when env flag is blank or unknown', () => {
    process.env.GRPC_OUTBOUND_DNS_STRICT = '   ';
    resetGrpcOutboundDnsPolicyForTests();
    expect(isGrpcOutboundDnsStrictEnabled()).toBe(true);

    process.env.GRPC_OUTBOUND_DNS_STRICT = 'maybe';
    resetGrpcOutboundDnsPolicyForTests();
    expect(isGrpcOutboundDnsStrictEnabled()).toBe(true);
  });

  it('ignores undefined strictDnsResolution in configureGrpcOutboundDnsPolicy', () => {
    configureGrpcOutboundDnsPolicy({ strictDnsResolution: false });
    configureGrpcOutboundDnsPolicy({});
    expect(isGrpcOutboundDnsStrictEnabled()).toBe(false);
  });
});
