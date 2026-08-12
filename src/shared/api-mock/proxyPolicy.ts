/**
 * API Mock Studio — outbound URL policy for proxy and callbacks (Phase 9B).
 * Extends the existing gRPC ServerOutboundUrlPolicy pattern.
 * Default-deny; allowlist-only; DNS-pinned connections.
 */

const BLOCKED_METADATA_HOSTS = new Set([
  'metadata.google.internal', 'metadata.goog',
  '169.254.169.254', 'fd00::1',
]);

const PRIVATE_IPV4 = /^(10\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|127\.|0\.)/;
const LOOPBACK_IPV6 = /^(::1|fe80:)/i;

const HOP_BY_HOP_HEADERS = new Set([
  'connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization',
  'te', 'trailer', 'transfer-encoding', 'upgrade',
]);

const CREDENTIAL_HEADERS = new Set([
  'authorization', 'proxy-authorization', 'cookie', 'x-api-key', 'api-key', 'x-auth-token',
]);

export const ANTI_RECURSION_HEADER = 'x-redfireforge-mock';

export interface ProxyPolicyConfig {
  allowedUpstreams: string[];
  forwardCredentialHeaders?: string[];
  maxRedirects?: number;
  timeoutMs?: number;
  maxResponseBytes?: number;
}

export interface PolicyCheckResult {
  allowed: boolean;
  reason?: string;
  resolvedHost?: string;
}

export function checkProxyUrl(url: string, config: ProxyPolicyConfig, activePorts: number[]): PolicyCheckResult {
  let parsed: URL;
  try { parsed = new URL(url); } catch { return { allowed: false, reason: `Invalid URL: ${url}` }; }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { allowed: false, reason: `Unsupported protocol: ${parsed.protocol}` };
  }

  const hostname = parsed.hostname.toLowerCase();
  if (BLOCKED_METADATA_HOSTS.has(hostname)) {
    return { allowed: false, reason: `Blocked metadata host: ${hostname}` };
  }
  if (PRIVATE_IPV4.test(hostname)) {
    return { allowed: false, reason: `Blocked private IPv4: ${hostname}` };
  }
  if (LOOPBACK_IPV6.test(hostname)) {
    return { allowed: false, reason: `Blocked IPv6 loopback: ${hostname}` };
  }

  const port = parsed.port ? parseInt(parsed.port, 10) : (parsed.protocol === 'https:' ? 443 : 80);
  if (isLocalhost(hostname) && activePorts.includes(port)) {
    return { allowed: false, reason: `Self-recursion: port ${port} is an active mock listener` };
  }
  if (isLocalhost(hostname) && port === 3001) {
    return { allowed: false, reason: 'Blocked: control plane port 3001' };
  }

  const origin = `${parsed.protocol}//${parsed.hostname}${parsed.port ? ':' + parsed.port : ''}`;
  const allowed = config.allowedUpstreams.some(u => origin.startsWith(u) || url.startsWith(u));
  if (!allowed) {
    return { allowed: false, reason: `Host not in allowlist: ${origin}` };
  }

  return { allowed: true, resolvedHost: hostname };
}

export function stripHopByHopHeaders(headers: Record<string, string | string[]>): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (!HOP_BY_HOP_HEADERS.has(key.toLowerCase())) out[key] = value;
  }
  return out;
}

export function stripCredentialHeaders(
  headers: Record<string, string | string[]>,
  forwardList?: string[],
): Record<string, string | string[]> {
  const allowed = new Set((forwardList ?? []).map(h => h.toLowerCase()));
  const out: Record<string, string | string[]> = {};
  for (const [key, value] of Object.entries(headers)) {
    const lk = key.toLowerCase();
    if (CREDENTIAL_HEADERS.has(lk) && !allowed.has(lk)) continue;
    out[key] = value;
  }
  return out;
}

export function addAntiRecursionHeader(headers: Record<string, string | string[]>): Record<string, string | string[]> {
  return { ...headers, [ANTI_RECURSION_HEADER]: 'true' };
}

export function hasAntiRecursionHeader(headers: Record<string, string | string[] | undefined>): boolean {
  const val = headers[ANTI_RECURSION_HEADER];
  return val === 'true' || (Array.isArray(val) && val.includes('true'));
}

export function stripSetCookieFromResponse(headers: Record<string, string | string[]>): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() !== 'set-cookie') out[key] = value;
  }
  return out;
}

function isLocalhost(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || hostname.endsWith('.localhost');
}
