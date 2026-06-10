export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/** Pretty-print a JSON string. Returns the original string if it's not valid JSON. */
export function prettyJson(text: string): string {
  try { return JSON.stringify(JSON.parse(text), null, 2); }
  catch { return text; }
}

/** Parse JSON, returning the raw string if parsing fails. */
export function parseJsonOrRaw(text: string): unknown {
  try { return JSON.parse(text); }
  catch { return text; }
}

/** Parse JSON safely: returns null for empty/falsy input, the parsed value on success, or the raw string on failure. */
export function parseJsonSafe(value: string): unknown {
  if (!value) return null;
  try { return JSON.parse(value); }
  catch { return value; }
}

/** Parse JSON, returning undefined if parsing fails. */
export function tryParseJson(text: string): unknown | undefined {
  try { return JSON.parse(text); }
  catch { return undefined; }
}

/** Check if a string is valid JSON. */
export function isValidJson(text: string): boolean {
  try { JSON.parse(text); return true; }
  catch { return false; }
}

/** Minify a JSON string. Returns null if the input is not valid JSON. */
export function minifyJson(text: string): string | null {
  try { return JSON.stringify(JSON.parse(text)); }
  catch { return null; }
}

export function truncate(str: string, maxLen: number, suffix = '...', suffixInsideBudget = true): string {
  if (suffixInsideBudget) {
    if (str.length <= maxLen) return str;
    const head = maxLen - suffix.length;
    if (head <= 0) return suffix.slice(0, maxLen);
    return str.slice(0, head) + suffix;
  }
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen) + suffix;
}

export function formatJson(str?: string): string {
  if (!str) return '';
  return prettyJson(str);
}

/** Escape special regex characters so the string can be used in `new RegExp(...)`. */
export function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Extract a human-readable message from an unknown caught value. */
export function toErrorMessage(err: unknown): string {
  if (err == null) return String(err);
  const parts: string[] = [];
  let current: unknown = err;
  const seen = new Set<unknown>();
  while (current && !seen.has(current)) {
    seen.add(current);
    if (current instanceof Error) {
      const code = (current as NodeJS.ErrnoException).code;
      parts.push(code ? `${current.message} [${code}]` : current.message);
      current = current.cause;
    } else {
      parts.push(String(current));
      break;
    }
  }
  return parts.join(' — ');
}

/**
 * Translate a technical error string into a user-friendly message.
 * Returns a friendly explanation followed by the technical detail in parentheses.
 */
export function humanizeError(technical: string): string {
  if (!technical) return technical;
  const t = technical.toLowerCase();

  // Extract hostname from the technical message for context
  const hostMatch = technical.match(/(?:ENOTFOUND|ECONNREFUSED|ETIMEDOUT|ECONNRESET)\s+([^\s[\]]+)/i)
    ?? technical.match(/(?:getaddrinfo|connect)\s+\w+\s+([^\s[\]]+)/i);
  const host = hostMatch?.[1] ?? '';

  const friendlyMap: Array<{ test: (s: string) => boolean; message: (h: string) => string }> = [
    {
      test: s => s.includes('oauth2 token request failed'),
      message: () => {
        // Remove the "OAuth2 token request failed:" prefix and humanize the underlying cause
        const inner = technical.replace(/^OAuth2 token request failed:\s*/i, '');
        const innerHumanized = humanizeError(inner);
        // If the inner was humanized (different from input), use it
        if (innerHumanized !== inner) {
          return `Authentication failed — ${innerHumanized}`;
        }
        return `Authentication failed — could not obtain an access token. ${inner}`;
      },
    },
    {
      test: s => s.includes('enotfound'),
      message: h => `Server not found${h ? ` (${h})` : ''}. Check the URL, your DNS settings, or VPN connection.`,
    },
    {
      test: s => s.includes('econnrefused'),
      message: h => `Connection refused${h ? ` by ${h}` : ''}. The server may be down or not accepting connections.`,
    },
    {
      test: s => s.includes('etimedout'),
      message: h => `Connection timed out${h ? ` to ${h}` : ''}. The server is not responding — check your network or firewall.`,
    },
    {
      test: s => s.includes('econnreset'),
      message: h => `Connection was reset${h ? ` by ${h}` : ''}. The server dropped the connection unexpectedly.`,
    },
    {
      test: s => s.includes('econnaborted'),
      message: () => 'Connection was aborted before it could complete.',
    },
    {
      test: s => s.includes('cert_has_expired') || s.includes('certificate has expired'),
      message: () => 'The server\'s SSL certificate has expired. Contact the server administrator.',
    },
    {
      test: s => s.includes('self_signed_cert') || s.includes('depth_zero_self_signed'),
      message: () => 'The server uses a self-signed SSL certificate that is not trusted.',
    },
    {
      test: s => s.includes('cert_altname_invalid') || s.includes('hostname/ip does not match'),
      message: () => 'The SSL certificate does not match the server hostname.',
    },
    {
      test: s => s.includes('unable_to_verify_leaf_signature'),
      message: () => 'The server\'s SSL certificate could not be verified. It may be missing a certificate chain.',
    },
    {
      test: s => s.includes('eproto') || s.includes('ssl routines'),
      message: () => 'SSL/TLS protocol error. The server may not support the required security protocol.',
    },
    {
      test: s => s.includes('cors') || s.includes('access-control-allow-origin'),
      message: () => 'Cross-origin request blocked. The server does not allow requests from this application.',
    },
    {
      test: s => s.includes('fetch failed') && !s.includes('enotfound') && !s.includes('econnrefused') && !s.includes('etimedout'),
      message: () => 'Network request failed. Check your internet connection or VPN.',
    },
    {
      test: s => /^(4\d\d|5\d\d)\s/.test(s.trim()),
      message: () => technical,
    },
  ];

  for (const { test, message } of friendlyMap) {
    if (test(t)) {
      const friendly = message(host);
      // Append technical detail if the friendly message is different
      if (friendly !== technical && !friendly.includes(technical)) {
        return `${friendly}\n↳ ${technical}`;
      }
      return friendly;
    }
  }

  return technical;
}

/** Deep-clone a plain JSON-safe value, preferring structuredClone when available. */
export function deepClone<T>(obj: T): T {
  try { return structuredClone(obj); }
  catch { return JSON.parse(JSON.stringify(obj)); }
}

/** @deprecated Use deepClone instead */
export function snapshot<T>(obj: T): T {
  return deepClone(obj);
}

/** Merge `incoming` items into `existing`, skipping items whose `id` already exists. */
export function mergeById<T extends { id: string }>(existing: T[], incoming: T[]): T[] {
  const ids = new Set(existing.map(x => x.id));
  return [...existing, ...incoming.filter(x => !ids.has(x.id))];
}

/** Format failure details from a RequestResult into a human-readable string. */
export function formatFailureDetails(
  details: ReadonlyArray<{ path?: string; expected?: string; actual?: string }>,
): string {
  return details
    .map(f => `${f.path}: expected ${f.expected}, got ${f.actual}`)
    .join('; ');
}

/** Get the error message for a failed result, falling back to formatted failure details. */
export function getResultErrorMessage(result: { errorMessage?: string; failureDetails: ReadonlyArray<{ path?: string; expected?: string; actual?: string }> }): string {
  return result.errorMessage || formatFailureDetails(result.failureDetails);
}
