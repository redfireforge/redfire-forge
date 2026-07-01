/**
 * Phase 3E — SSRF-safe URL policy for server-side proto fetches.
 */

export interface ProtoFetchPolicyOptions {
  /** Allow http:// for localhost / 127.0.0.1 (dev override). Default true. */
  allowHttpLocalhost?: boolean;
}

export class ProtoFetchPolicyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProtoFetchPolicyError';
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

function isPrivateOrReservedIpv4(hostname: string): boolean {
  if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) {
    return false;
  }
  return PRIVATE_IPV4_PATTERN.test(hostname);
}

export function validateProtoFetchUrl(
  rawUrl: string,
  options: ProtoFetchPolicyOptions = {},
): URL {
  const allowHttpLocalhost = options.allowHttpLocalhost !== false;
  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    throw new ProtoFetchPolicyError('Invalid URL for proto fetch');
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new ProtoFetchPolicyError('Proto fetch URL must use http or https');
  }

  const hostname = parsed.hostname.toLowerCase();
  if (BLOCKED_HOSTNAMES.has(hostname)) {
    throw new ProtoFetchPolicyError(`Proto fetch blocked for host: ${hostname}`);
  }

  if (parsed.protocol === 'http:') {
    const local = isLocalhostHostname(hostname) || hostname === '127.0.0.1';
    if (!allowHttpLocalhost || !local) {
      throw new ProtoFetchPolicyError('http:// proto fetch is allowed only for localhost in dev mode');
    }
  }

  if (parsed.protocol === 'https:') {
    if (hostname === '127.0.0.1' || isLocalhostHostname(hostname)) {
      throw new ProtoFetchPolicyError('https:// proto fetch to loopback hosts is not allowed');
    }
  }

  if (isPrivateOrReservedIpv4(hostname) && hostname !== '127.0.0.1') {
    throw new ProtoFetchPolicyError(`Proto fetch blocked for private network host: ${hostname}`);
  }

  if (hostname.startsWith('[') || hostname.includes('%')) {
    throw new ProtoFetchPolicyError('IPv6 literal hosts are not supported for proto fetch');
  }

  return parsed;
}

export function protoPathFromFetchUrl(url: URL): string {
  const segments = url.pathname.split('/').filter(Boolean);
  const basename = segments.at(-1) ?? 'fetched.proto';
  return basename.endsWith('.proto') ? basename : `${basename}.proto`;
}
