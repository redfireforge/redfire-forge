/** True when the URL targets a loopback host (local dev servers). */
export function isLoopbackUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '[::1]';
  } catch {
    return false;
  }
}

/**
 * Rewrite loopback hostnames to 127.0.0.1 so Node/undici and corporate HTTP proxies
 * do not fail DNS lookup for "localhost" (ENOTFOUND).
 */
export function resolveLoopbackUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    if (host === 'localhost' || host === '::1') {
      parsed.hostname = '127.0.0.1';
      return parsed.toString();
    }
  } catch {
    /* keep original */
  }
  return url;
}

/**
 * Prefer `localhost` over numeric loopback — matches typical NO_PROXY lists on
 * corporate networks (localhost is listed; 127.0.0.1 often is not).
 */
export function preferLocalhostHostname(url: string): string {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    if (host === '127.0.0.1' || host === '::1' || host === '[::1]') {
      parsed.hostname = 'localhost';
      return parsed.toString();
    }
  } catch {
    /* keep original */
  }
  return url;
}
