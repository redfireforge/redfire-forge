/**
 * Shared SSRF-safe URL policy for server-side outbound fetches (proto, OAuth token, etc.).
 */
import { lookup as dnsLookup } from 'node:dns/promises';

export interface ServerOutboundUrlPolicyOptions {
  /** Allow http:// for localhost / 127.0.0.1 (dev override). Default true. */
  allowHttpLocalhost?: boolean;
  /** Block https:// to loopback hosts. Default true. */
  blockHttpsLoopback?: boolean;
}

export interface ServerOutboundDnsValidationOptions extends ServerOutboundUrlPolicyOptions {
  /** Optional resolver override for tests/hardening adapters. */
  resolveHostname?: (hostname: string) => Promise<string[]>;
  /** Disable DNS resolution hardening (default false). */
  skipDnsResolution?: boolean;
}

export class ServerOutboundUrlPolicyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ServerOutboundUrlPolicyError';
  }
}

const BLOCKED_HOSTNAMES = new Set([
  'metadata.google.internal',
  'metadata.goog',
]);

const PRIVATE_IPV4_PATTERN = /^(10\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|0\.)/;

function isLocalhostHostname(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  return lower === 'localhost' || lower === '::1' || lower.endsWith('.localhost');
}

function isIpv4Loopback(hostname: string): boolean {
  const match = hostname.match(/^(\d{1,3})(?:\.(\d{1,3})){3}$/);
  if (!match) {
    return false;
  }
  return Number(match[1]) === 127;
}

function isIpv4Address(hostname: string): boolean {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname);
}

function normalizeResolvedAddress(address: string): string {
  return address.toLowerCase().trim().replace(/%.*$/, '');
}

function parseIpv4MappedIpv6(address: string): string | null {
  const normalized = normalizeResolvedAddress(address);
  if (!normalized.startsWith('::ffff:')) {
    return null;
  }
  const mapped = normalized.slice('::ffff:'.length);
  return isIpv4Address(mapped) ? mapped : null;
}

function isIpv6Loopback(address: string): boolean {
  return normalizeResolvedAddress(address) === '::1';
}

function isPrivateOrReservedIpv6(address: string): boolean {
  const normalized = normalizeResolvedAddress(address);
  if (normalized === '::') return true;
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true; // ULA fc00::/7
  if (normalized.startsWith('fe8') || normalized.startsWith('fe9') || normalized.startsWith('fea') || normalized.startsWith('feb')) {
    return true; // link-local fe80::/10
  }
  return false;
}

function canonicalizeHostname(hostname: string): string {
  return hostname.endsWith('.') ? hostname.slice(0, -1) : hostname;
}

function shouldSkipDnsLookup(hostname: string): boolean {
  return isIpv4Address(hostname)
    || hostname.startsWith('[')
    || hostname.includes(':')
    || isLocalhostHostname(hostname);
}

function assertResolvedAddressAllowed(address: string, protocol: string): void {
  const normalized = normalizeResolvedAddress(address);
  const mappedIpv4 = parseIpv4MappedIpv6(normalized);
  const ipv4 = mappedIpv4 ?? (isIpv4Address(normalized) ? normalized : null);

  if (ipv4) {
    if (protocol === 'https:' && isIpv4Loopback(ipv4)) {
      throw new ServerOutboundUrlPolicyError(
        `Outbound fetch DNS resolution blocked loopback address: ${address}`,
      );
    }
    if (isPrivateOrReservedIpv4(ipv4) && ipv4 !== '127.0.0.1') {
      throw new ServerOutboundUrlPolicyError(
        `Outbound fetch DNS resolution blocked private network address: ${address}`,
      );
    }
    return;
  }

  if (isIpv6Loopback(normalized)) {
    throw new ServerOutboundUrlPolicyError(
      `Outbound fetch DNS resolution blocked loopback address: ${address}`,
    );
  }
  if (isPrivateOrReservedIpv6(normalized)) {
    throw new ServerOutboundUrlPolicyError(
      `Outbound fetch DNS resolution blocked private network address: ${address}`,
    );
  }
}

async function defaultResolveHostname(hostname: string): Promise<string[]> {
  const records = await dnsLookup(hostname, { all: true });
  return records.map((entry) => entry.address);
}

function isPrivateOrReservedIpv4(hostname: string): boolean {
  if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) {
    return false;
  }
  return PRIVATE_IPV4_PATTERN.test(hostname);
}

export function validateServerOutboundUrl(
  rawUrl: string,
  options: ServerOutboundUrlPolicyOptions = {},
): URL {
  const allowHttpLocalhost = options.allowHttpLocalhost !== false;
  const blockHttpsLoopback = options.blockHttpsLoopback !== false;
  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    throw new ServerOutboundUrlPolicyError('Invalid outbound fetch URL');
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new ServerOutboundUrlPolicyError('Outbound fetch URL must use http or https');
  }

  if (parsed.username || parsed.password) {
    throw new ServerOutboundUrlPolicyError('Outbound fetch URL must not include embedded credentials');
  }

  const hostname = parsed.hostname.toLowerCase();
  const canonicalHostname = canonicalizeHostname(hostname);
  if (BLOCKED_HOSTNAMES.has(canonicalHostname)) {
    throw new ServerOutboundUrlPolicyError(`Outbound fetch blocked for host: ${canonicalHostname}`);
  }

  if (parsed.protocol === 'http:') {
    const local = isLocalhostHostname(canonicalHostname) || canonicalHostname === '127.0.0.1';
    if (!allowHttpLocalhost || !local) {
      throw new ServerOutboundUrlPolicyError(
        'http:// outbound fetch is allowed only for localhost in dev mode',
      );
    }
  }

  if (blockHttpsLoopback && parsed.protocol === 'https:') {
    if (isIpv4Loopback(canonicalHostname) || isLocalhostHostname(canonicalHostname)) {
      throw new ServerOutboundUrlPolicyError('https:// outbound fetch to loopback hosts is not allowed');
    }
  }

  if (isPrivateOrReservedIpv4(canonicalHostname) && canonicalHostname !== '127.0.0.1') {
    throw new ServerOutboundUrlPolicyError(
      `Outbound fetch blocked for private network host: ${canonicalHostname}`,
    );
  }

  if (canonicalHostname.startsWith('[') || canonicalHostname.includes('%')) {
    throw new ServerOutboundUrlPolicyError('IPv6 literal hosts are not supported for outbound fetch');
  }

  return parsed;
}

export async function validateServerOutboundUrlWithDns(
  rawUrl: string,
  options: ServerOutboundDnsValidationOptions = {},
): Promise<URL> {
  const parsed = validateServerOutboundUrl(rawUrl, options);
  if (options.skipDnsResolution) {
    return parsed;
  }

  const canonicalHostname = canonicalizeHostname(parsed.hostname.toLowerCase());
  if (shouldSkipDnsLookup(canonicalHostname)) {
    return parsed;
  }

  const resolver = options.resolveHostname ?? defaultResolveHostname;
  let addresses: string[];
  try {
    addresses = await resolver(canonicalHostname);
  } catch (error) {
    const detail = error instanceof Error ? `: ${error.message}` : '';
    throw new ServerOutboundUrlPolicyError(
      `Outbound fetch DNS resolution failed for host: ${canonicalHostname}${detail}`,
    );
  }

  if (addresses.length === 0) {
    throw new ServerOutboundUrlPolicyError(
      `Outbound fetch DNS resolution returned no addresses for host: ${canonicalHostname}`,
    );
  }

  for (const address of addresses) {
    assertResolvedAddressAllowed(address, parsed.protocol);
  }

  return parsed;
}
