/**
 * Central runtime policy for server-side gRPC outbound DNS hardening.
 */

function parseBooleanFlag(value: string | undefined, fallback: boolean): boolean {
  if (value == null) {
    return fallback;
  }
  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return fallback;
  }
  if (normalized === '0' || normalized === 'false' || normalized === 'off' || normalized === 'no') {
    return false;
  }
  if (normalized === '1' || normalized === 'true' || normalized === 'on' || normalized === 'yes') {
    return true;
  }
  return fallback;
}

function resolveDefaultStrictDns(): boolean {
  return parseBooleanFlag(process.env.GRPC_OUTBOUND_DNS_STRICT, true);
}

let strictOutboundDnsResolution = resolveDefaultStrictDns();

export function isGrpcOutboundDnsStrictEnabled(): boolean {
  return strictOutboundDnsResolution;
}

export function configureGrpcOutboundDnsPolicy(options: {
  strictDnsResolution?: boolean;
}): void {
  if (options.strictDnsResolution !== undefined) {
    strictOutboundDnsResolution = options.strictDnsResolution;
  }
}

export function resetGrpcOutboundDnsPolicyForTests(): void {
  strictOutboundDnsResolution = resolveDefaultStrictDns();
}
