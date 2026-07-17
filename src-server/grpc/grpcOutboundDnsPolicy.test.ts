/**
 * @vitest-environment node
 */
import { afterEach, describe, expect, it } from 'vitest';
import {
  configureGrpcOutboundDnsPolicy,
  isGrpcOutboundDnsStrictEnabled,
  resetGrpcOutboundDnsPolicyForTests,
} from './grpcOutboundDnsPolicy.js';

describe('grpcOutboundDnsPolicy', () => {
  afterEach(() => {
    resetGrpcOutboundDnsPolicyForTests();
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
  });
});
