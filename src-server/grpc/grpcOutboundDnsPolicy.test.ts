/**
 * @vitest-environment node
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  configureGrpcOutboundDnsPolicy,
  isGrpcOutboundDnsStrictEnabled,
  resetGrpcOutboundDnsPolicyForTests,
} from './grpcOutboundDnsPolicy.js';

async function loadPolicy() {
  vi.resetModules();
  return import('./grpcOutboundDnsPolicy.js');
}

describe('grpcOutboundDnsPolicy', () => {
  afterEach(() => {
    delete process.env.GRPC_OUTBOUND_DNS_STRICT;
    vi.resetModules();
  });

  it('defaults to strict DNS hardening', () => {
    resetGrpcOutboundDnsPolicyForTests();
    expect(isGrpcOutboundDnsStrictEnabled()).toBe(true);
  });

  it('allows runtime override for operations toggles', () => {
    configureGrpcOutboundDnsPolicy({ strictDnsResolution: false });
    expect(isGrpcOutboundDnsStrictEnabled()).toBe(false);

    configureGrpcOutboundDnsPolicy({ strictDnsResolution: true });
    expect(isGrpcOutboundDnsStrictEnabled()).toBe(true);

    resetGrpcOutboundDnsPolicyForTests();
  });

  it('reads strict DNS defaults from the environment', async () => {
    process.env.GRPC_OUTBOUND_DNS_STRICT = 'off';
    let policy = await loadPolicy();
    expect(policy.isGrpcOutboundDnsStrictEnabled()).toBe(false);

    process.env.GRPC_OUTBOUND_DNS_STRICT = 'yes';
    policy = await loadPolicy();
    expect(policy.isGrpcOutboundDnsStrictEnabled()).toBe(true);
  });

  it('falls back to the default for blank or invalid env values', async () => {
    process.env.GRPC_OUTBOUND_DNS_STRICT = '   ';
    let policy = await loadPolicy();
    expect(policy.isGrpcOutboundDnsStrictEnabled()).toBe(true);

    process.env.GRPC_OUTBOUND_DNS_STRICT = 'maybe';
    policy = await loadPolicy();
    expect(policy.isGrpcOutboundDnsStrictEnabled()).toBe(true);
  });
});
