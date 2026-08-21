/**
 * Headers that must not be forwarded as user-controlled request headers when
 * replaying captured traffic or calling Node/undici `fetch`.
 *
 * Journal captures often include hop-by-hop / client-managed fields (`connection`,
 * `host`, …). Passing those through Vite `/__proxy` or Node `fetch` alongside the
 * transport's own `Connection: keep-alive` produces a case-duplicate pair
 * (`connection` + `Connection`) and undici throws
 * `invalid connection header [UND_ERR_INVALID_ARG]`.
 */

const CLIENT_MANAGED_REQUEST_HEADERS = new Set([
  // Hop-by-hop (RFC 9110)
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'proxy-connection',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  // Client / transport managed (Fetch + undici)
  'host',
  'content-length',
  'accept-encoding',
  'accept-charset',
]);

export function isClientManagedRequestHeader(name: string): boolean {
  return CLIENT_MANAGED_REQUEST_HEADERS.has(name.trim().toLowerCase());
}

/** Drop hop-by-hop / transport-managed headers from a plain header map. */
export function stripClientManagedRequestHeaders(
  headers: Record<string, string>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (isClientManagedRequestHeader(key)) continue;
    out[key] = value;
  }
  return out;
}

/**
 * Prepare headers for a keep-alive outbound fetch: remove any existing
 * Connection/Host/Content-Length variants (any casing), then set a single
 * `Connection: keep-alive`.
 */
export function withKeepAliveConnection(
  headers: Record<string, string>,
): Record<string, string> {
  const out = stripClientManagedRequestHeaders(headers);
  out.Connection = 'keep-alive';
  return out;
}
